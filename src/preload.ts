import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('electronAPI', {
  analyzeKeywords: (keyword: string): Promise<string> => 
    ipcRenderer.invoke('analyze-keywords', keyword),
});

// windowオブジェクトに型定義を追加
declare global {
  interface Window {
    electronAPI: {
      analyzeKeywords: (keyword: string) => Promise<string>;
    };
  }
}
