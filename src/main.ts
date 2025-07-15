import { app, BrowserWindow, ipcMain } from 'electron';
import * as path from 'path';
import { analyzeKeywords } from './analyzer';
import * as dotenv from 'dotenv';
import * as fs from 'fs'; // fsモジュールを追加

dotenv.config();

try {
  fs.writeFileSync(path.join(process.cwd(), 'main_process_start.log'), 'Electron main process started successfully.\n');
} catch (e) {
  console.error('Failed to write start log:', e);
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
    },
  });

      win.loadFile(path.join(__dirname, 'index.html'));
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

ipcMain.handle('analyze-keywords', async (event, keyword: string) => {
  try {
        const geminiApiKey = process.env.GEMINI_API_KEY!;
    const searchEngineId = process.env.SEARCH_ENGINE_ID!;
    const report = await analyzeKeywords(keyword, geminiApiKey, searchEngineId);
    return report;
  } catch (error) {
    console.error(error);
    return 'エラーが発生しました。詳細はコンソールを確認してください。';
  }
});
