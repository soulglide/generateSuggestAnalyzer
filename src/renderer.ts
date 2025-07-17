document.addEventListener('DOMContentLoaded', () => {
  const analyzeButton = document.getElementById('analyze-btn') as HTMLButtonElement;
  const keywordInput = document.getElementById('keyword-input') as HTMLInputElement;
  const resultCountInput = document.getElementById('result-count-input') as HTMLInputElement;
  const resultDiv = document.getElementById('result') as HTMLDivElement;
  const clearButton = document.getElementById('clear-btn') as HTMLButtonElement;

  clearButton.addEventListener('click', () => {
    resultDiv.innerHTML = '';
    keywordInput.value = ''; // キーワード入力フィールドをクリア
  });

  analyzeButton.addEventListener('click', async () => {
    const keyword = keywordInput.value;
    const resultCount = parseInt(resultCountInput.value, 10);

    if (!keyword) {
      resultDiv.innerHTML = 'キーワードを入力してください。';
      return;
    }

    if (isNaN(resultCount) || resultCount <= 0) {
      resultDiv.innerHTML = '表示件数は1以上の数値を入力してください。';
      return;
    }

    resultDiv.innerHTML = '分析中...';
    analyzeButton.disabled = true;

    try {
      const report = await window.electronAPI.analyzeKeywords(keyword, resultCount);
      resultDiv.innerHTML = report.replace(/\n/g, '<br>'); // 改行を<br>に変換して表示
    } catch (error) {      
      if (error instanceof Error) {
        resultDiv.innerHTML = `エラーが発生しました: ${error.message}`;
      } else {
        resultDiv.innerHTML = `予期せぬエラーが発生しました。`;
      }
    } finally {
      analyzeButton.disabled = false;
    }
  });
});
