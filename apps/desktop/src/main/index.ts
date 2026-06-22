import { app, BrowserWindow } from 'electron';
import { access } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const currentDirectory = dirname(fileURLToPath(import.meta.url));
const SMOKE_TEST_TIMEOUT_MS = 15_000;

interface CreateMainWindowOptions {
  show?: boolean;
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
      nodeIntegration: false
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
  await access(join(currentDirectory, '../../renderer/index.html'));
  const window = await createMainWindow({ show: false });
  window.destroy();
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
