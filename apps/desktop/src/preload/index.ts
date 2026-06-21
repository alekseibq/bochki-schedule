import { contextBridge, ipcRenderer } from 'electron';
import type { ScheduleDocument } from '@bochki/domain';

export interface BochkiDesktopApi {
  data: {
    load: () => Promise<ScheduleDocument>;
  };
}

const api: BochkiDesktopApi = {
  data: {
    load: () => ipcRenderer.invoke('data:load') as Promise<ScheduleDocument>
  }
};

contextBridge.exposeInMainWorld('bochki', api);
