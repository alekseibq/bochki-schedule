import { contextBridge, ipcRenderer } from 'electron';
import type { LoadDataResult } from '../shared/data.js';

export interface BochkiDesktopApi {
  data: {
    load: () => Promise<LoadDataResult>;
  };
}

const api: BochkiDesktopApi = {
  data: {
    load: () => ipcRenderer.invoke('data:load') as Promise<LoadDataResult>
  }
};

contextBridge.exposeInMainWorld('bochki', api);
