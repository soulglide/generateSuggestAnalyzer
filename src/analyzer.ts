import axios from 'axios';
import { GoogleGenerativeAI } from '@google/generative-ai';
import * as fs from 'fs';
import * as path from 'path';
import * as iconv from 'iconv-lite';

const ANALYZER_LOG_FILE = path.join(process.cwd(), 'analyzer_debug.log');

function writeLog(message: string) {
  fs.appendFileSync(ANALYZER_LOG_FILE, `${new Date().toISOString()} - ${message}\n`);
}

// --- 設定 ---



const CUSTOM_SEARCH_ENDPOINT = 'https://www.googleapis.com/customsearch/v1';

// --- 型定義 ---
interface SuggestionResult {
  keyword: string;
  searchVolume: number;
}

// --- 内部関数 ---
async function getGoogleSuggestions(keyword: string): Promise<string[]> {
  try {
    const response = await axios.get(`http://suggestqueries.google.com/complete/search?client=firefox&q=${encodeURIComponent(keyword)}&hl=ja`, { responseType: 'arraybuffer' });
    const decodedData = iconv.decode(response.data, 'Shift_JIS');
    const jsonData = JSON.parse(decodedData);
    writeLog(`Google Suggest API からの生データ: ${JSON.stringify(jsonData)}`); // ここを追加
    if (jsonData && Array.isArray(jsonData[1])) {
      return jsonData[1];
    }
    return [];
  } catch (error: any) {
    writeLog(`Google Suggestの取得に失敗しました: ${error.message || error}`);
    if (error.response && error.response.data) {
      writeLog(`Google Suggest レスポンスエラーデータ: ${JSON.stringify(error.response.data)}`);
    }
    return [];
  }
}

async function getGoogleSearchResultCount(query: string, customSearchApiKey: string, searchEngineId: string): Promise<number> {
  if (!customSearchApiKey || !searchEngineId) {
    writeLog(`[警告] CUSTOM_SEARCH_API_KEY または SEARCH_ENGINE_ID が未設定です。ダミーの検索ヒット数を返します。`);
    return Math.floor(Math.random() * 1000000);
  }

  try {
    const response = await axios.get(CUSTOM_SEARCH_ENDPOINT, {
      params: {
        key: customSearchApiKey,
        cx: searchEngineId,
        q: query,
      },
    });
    const totalResults = response.data?.searchInformation?.totalResults;
    return totalResults ? parseInt(totalResults, 10) : 0;
  } catch (error: any) {
        writeLog(`'${query}'のGoogle検索ヒット数の取得に失敗しました。 エラー詳細: ${JSON.stringify(error.response?.data)}`);
    return 0;
  }
}

async function generateReportWithGemini(data: SuggestionResult[], geminiApiKey: string): Promise<string> {
  if (!geminiApiKey) {
    return '[エラー] GEMINI_API_KEYが環境変数に設定されていません.\n簡易レポートを生成します.\n\n' + `--- 競合キーワード Top 5 ---\n${data.map((d, i) => `${i+1}. ${d.keyword} (${d.searchVolume.toLocaleString()}件)`).join('\n')}`;
  }
    const genAI = new GoogleGenerativeAI(geminiApiKey);
  const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });

  const promptPath = path.resolve(__dirname, '../prompts/suggest.gprompt');
  const promptTemplate = fs.readFileSync(promptPath, 'utf-8');
  const prompt = promptTemplate.replace('{{input}}', JSON.stringify(data, null, 2));

  let retries = 3;
  let delay = 1000;

  while (retries > 0) {
    try {
      const result = await model.generateContent(prompt);
      const response = await result.response;
      return response.text();
    } catch (error: any) {
      if (error.message.includes('503')) {
        writeLog(`Gemini APIがビジー状態です。リトライします... (残り: ${retries - 1}回)`);
        retries--;
        if (retries > 0) {
          await new Promise(res => setTimeout(res, delay));
          delay *= 2; // Exponential backoff
        } else {
          writeLog(`Gemini APIのリトライにすべて失敗しました。`);
          return `[エラー] Gemini APIが大変混み合っています。しばらくしてから再度お試しください。\n\n` + `--- 競合キーワード Top 5 ---\n${data.map((d, i) => `${i+1}. ${d.keyword} (${d.searchVolume.toLocaleString()}件)`).join('\n')}`;
        }
      } else {
        writeLog(`Geminiでのレポート生成に失敗しました: ${error}`);
        return `[エラー] Geminiでのレポート生成に失敗しました.\n${error.message}\n\n` + `--- 競合キーワード Top 5 ---\n${data.map((d, i) => `${i+1}. ${d.keyword} (${d.searchVolume.toLocaleString()}件)`).join('\n')}`;
      }
    }
  }
  // This part should be unreachable, but as a fallback:
  return `[エラー] 不明なエラーが発生しました。`;
}

// --- 公開関数 ---
export async function analyzeKeywords(keyword: string, geminiApiKey: string, searchEngineId: string): Promise<string> {
  // 内部関数にAPIキーを渡す
  const getGoogleSearchResultCountWithKeys = (query: string) => getGoogleSearchResultCount(query, geminiApiKey, searchEngineId);
  const generateReportWithGeminiWithKey = (data: SuggestionResult[]) => generateReportWithGemini(data, geminiApiKey);

  if (!keyword) {
    return 'キーワードが入力されていません。';
  }

  const suggestions = await getGoogleSuggestions(keyword);
  writeLog(`取得したサジェストキーワード: ${JSON.stringify(suggestions)}`);
  if (suggestions.length === 0) {
    return 'サジェストキーワードが見つかりませんでした。';
  }

  const suggestionResults: SuggestionResult[] = await Promise.all(
    suggestions.map(async (sug) => {
      const count = await getGoogleSearchResultCountWithKeys(sug);
      writeLog(`キーワード: ${sug}, 検索ヒット件数: ${count}`);
      return { keyword: sug, searchVolume: count };
    })
  );

  const sortedResults = suggestionResults
    .filter(r => r.searchVolume > 0)
    .sort((a, b) => a.searchVolume - b.searchVolume)
    .slice(0, 5);

  writeLog(`フィルタリング・ソート後の結果: ${JSON.stringify(sortedResults)}`);

  if (sortedResults.length === 0) {
    return '分析可能なキーワードが見つかりませんでした。';
  }

  const report = await generateReportWithGeminiWithKey(sortedResults);
  return report;
}