import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('electronAPI', {
  analyzeKeywords: (keyword: string, resultCount: number): Promise<string> => 
    ipcRenderer.invoke('analyze-keywords', keyword, resultCount),
});

// windowオブジェクトに型定義を追加
declare global {
  interface Window {
    electronAPI: {
      analyzeKeywords: (keyword: string, resultCount: number) => Promise<string>;
    };
  }
}
