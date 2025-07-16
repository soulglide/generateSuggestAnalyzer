import { app, BrowserWindow, ipcMain } from 'electron';
import * as path from 'path';
import { analyzeKeywords } from './analyzer';
import * as dotenv from 'dotenv';
import * as fs from 'fs';

// ★★★ ここから追加 ★★★
const logFilePath = path.join(app.getPath('logs'), 'main_process_start.log');

// 既存のログファイルをクリア（または新しいセッションの開始を示す）
fs.writeFileSync(logFilePath, '-- App Session Started --\n');

// console.logとconsole.errorの出力をファイルにリダイレクト
const originalConsoleLog = console.log;
const originalConsoleError = console.error;

console.log = (...args) => {
  originalConsoleLog(...args);
  fs.appendFileSync(logFilePath, `[LOG] ${args.join(' ')}\n`);
};

console.error = (...args) => {
  originalConsoleError(...args);
  fs.appendFileSync(logFilePath, `[ERROR] ${args.join(' ')}\n`);
};
// ★★★ ここまで追加 ★★★

const dotEnvPath = path.join(__dirname, '..', '.env');
console.log(`[Debug] Loading .env file from: ${dotEnvPath}`);
dotenv.config({ path: dotEnvPath });

console.log(`[Debug] GEMINI_API_KEY: ${process.env.GEMINI_API_KEY ? 'Loaded' : 'NOT LOADED'}`);
console.log(`[Debug] SEARCH_ENGINE_ID: ${process.env.SEARCH_ENGINE_ID ? 'Loaded' : 'NOT LOADED'}`);

try {
  // この行はリダイレクトされるので不要だが、念のため残す
  // fs.writeFileSync(logPath, 'Electron main process started successfully.\n');
  console.log(`[Debug] Initial log setup complete.`);
} catch (e) {
  console.error('Failed to write initial log:', e);
}

console.log('Electronメインプロセスが起動しました。');

function createWindow() {
  const win = new BrowserWindow({
    width: 800,
    height: 600,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      devTools: true,
    },
  });

      win.loadFile(path.join(__dirname, 'index.html'));
      win.webContents.openDevTools();
}

app.whenReady().then(() => {
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

ipcMain.handle('analyze-keywords', async (event, keyword: string, resultCount: number) => {
  try {
        const geminiApiKey = process.env.GEMINI_API_KEY!;
    const searchEngineId = process.env.SEARCH_ENGINE_ID!;
    const report = await analyzeKeywords(keyword, geminiApiKey, searchEngineId, resultCount, app.getPath('logs'));
    return report;
  } catch (error) {
    console.error(error);
    return 'エラーが発生しました。詳細はコンソールを確認してください。';
  }
});
