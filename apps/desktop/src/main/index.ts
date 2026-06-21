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
    show: process.env.BOCHKI_E2E_SELF_TEST !== '1',
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

  if (process.env.BOCHKI_E2E_SELF_TEST === '1') {
    await runE2eSelfTest(window);
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
  if (
    process.platform !== 'darwin' ||
    process.env.BOCHKI_E2E === '1' ||
    process.env.BOCHKI_E2E_SELF_TEST === '1'
  ) {
    app.quit();
  }
});

async function runE2eSelfTest(window: BrowserWindow): Promise<void> {
  try {
    console.log('[e2e] renderer self-test started');
    await window.webContents.executeJavaScript(`
      (async () => {
        const waitFor = async (predicate, label) => {
          const startedAt = Date.now();
          while (Date.now() - startedAt < 5000) {
            if (predicate()) {
              return;
            }
            await new Promise((resolve) => setTimeout(resolve, 50));
          }
          throw new Error('Timed out waiting for ' + label);
        };

        await waitFor(() => document.querySelector('[data-testid="home-page"]'), 'home page');

        if (!document.body.innerText.includes('Справочники')) {
          throw new Error('Dictionaries menu is not rendered');
        }

        window.location.hash = '#/dictionaries/participants';
        await waitFor(
          () => document.querySelector('[data-testid="participants-page"]'),
          'participants page'
        );

        window.location.hash = '#/dictionaries/trainers';
        await waitFor(
          () => document.querySelector('[data-testid="trainers-page"]'),
          'trainers page'
        );
      })();
    `);
    console.log('[e2e] renderer self-test passed');
    app.exit(0);
  } catch (error) {
    console.error('[e2e] renderer self-test failed', error);
    app.exit(1);
  }
}
