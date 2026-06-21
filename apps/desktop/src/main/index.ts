import { app, BrowserWindow, ipcMain } from 'electron';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { JsonFileStorage } from '@bochki/storage';
import { resolveDataFilePath } from './paths.js';

const currentDirectory = dirname(fileURLToPath(import.meta.url));

function getDataFilePath(): string {
  const dataDirectory = process.env.BOCHKI_DATA_DIR ?? app.getPath('userData');
  return resolveDataFilePath(dataDirectory);
}

function createStorage(): JsonFileStorage {
  return new JsonFileStorage({
    dataFilePath: getDataFilePath(),
    keepBackup: true
  });
}

async function createMainWindow(): Promise<void> {
  const window = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 900,
    minHeight: 600,
    title: 'Расписание Бочки',
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      preload: join(currentDirectory, '../preload/index.js')
    }
  });

  if (process.env.VITE_DEV_SERVER_URL) {
    await window.loadURL(process.env.VITE_DEV_SERVER_URL);
  } else {
    await window.loadFile(join(currentDirectory, '../../renderer/index.html'));
  }
}

ipcMain.handle('data:load', async () => createStorage().ensureDocument());

await app.whenReady();
await createMainWindow();

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    void createMainWindow();
  }
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
