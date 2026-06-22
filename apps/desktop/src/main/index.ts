import { app, BrowserWindow, ipcMain } from 'electron';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { JsonFileStorage } from '@bochki/storage';
import { loadData } from './data.js';
import { resolveDataFilePath } from './paths.js';

const currentDirectory = dirname(fileURLToPath(import.meta.url));
const SMOKE_TEST_TIMEOUT_MS = 15_000;

interface CreateMainWindowOptions {
  show?: boolean;
}

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

async function createMainWindow(
  options: CreateMainWindowOptions = {}
): Promise<BrowserWindow> {
  const window = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 900,
    minHeight: 600,
    show: options.show ?? true,
    title: 'Bochki Schedule',
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

  return window;
}

async function runPackagedSmokeTest(): Promise<void> {
  const window = await createMainWindow({ show: false });

  await window.webContents.executeJavaScript(`
    (async () => {
      const waitForHomePage = async () => {
        const deadline = Date.now() + 5000;

        while (!document.querySelector('[data-testid="home-page"]')) {
          if (Date.now() > deadline) {
            throw new Error('Home page marker was not rendered.');
          }

          await new Promise((resolve) => setTimeout(resolve, 100));
        }
      };

      await waitForHomePage();

      if (!window.bochki?.data?.load) {
        throw new Error('Preload API is not available.');
      }

      const result = await window.bochki.data.load();

      if (result?.document?.schemaVersion !== 1) {
        throw new Error('Unexpected data load result.');
      }

      return true;
    })();
  `);
}

async function withTimeout<T>(
  operation: Promise<T>,
  timeoutMs: number
): Promise<T> {
  let timeout: ReturnType<typeof setTimeout> | undefined;

  try {
    return await Promise.race([
      operation,
      new Promise<never>((_resolve, reject) => {
        timeout = setTimeout(
          () => reject(new Error(`Timed out after ${timeoutMs}ms.`)),
          timeoutMs
        );
      })
    ]);
  } finally {
    if (timeout) {
      clearTimeout(timeout);
    }
  }
}

ipcMain.handle('data:load', async () =>
  loadData(createStorage(), getDataFilePath())
);

await app.whenReady();

if (process.env.BOCHKI_SMOKE_TEST === '1') {
  try {
    await withTimeout(runPackagedSmokeTest(), SMOKE_TEST_TIMEOUT_MS);
    app.exit(0);
  } catch (error) {
    console.error('Packaged smoke test failed.', error);
    app.exit(1);
  }
} else {
  await createMainWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      void createMainWindow();
    }
  });
}

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
