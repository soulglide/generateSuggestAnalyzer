document.addEventListener('DOMContentLoaded', () => {
  const analyzeButton = document.getElementById('analyze-btn') as HTMLButtonElement;
  const keywordInput = document.getElementById('keyword-input') as HTMLInputElement;
  const resultDiv = document.getElementById('result') as HTMLDivElement;

  analyzeButton.addEventListener('click', async () => {
    const keyword = keywordInput.value;
    if (!keyword) {
      resultDiv.innerHTML = 'キーワードを入力してください。';
      return;
    }

    resultDiv.innerHTML = '分析中...';
    analyzeButton.disabled = true;

    try {
      const report = await window.electronAPI.analyzeKeywords(keyword);
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
