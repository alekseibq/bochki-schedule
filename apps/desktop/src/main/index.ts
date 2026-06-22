import { app, BrowserWindow } from 'electron';
import { access } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createStartupDiagnostics } from './startup-diagnostics.js';

const currentDirectory = dirname(fileURLToPath(import.meta.url));
const SMOKE_TEST_TIMEOUT_MS = 15_000;
const startupDiagnostics = createStartupDiagnostics();
let latestWindow: BrowserWindow | null = null;

interface CreateMainWindowOptions {
  show?: boolean;
}

async function createMainWindow(
  options: CreateMainWindowOptions = {}
): Promise<BrowserWindow> {
  await startupDiagnostics.mark('main:before-browser-window-create', {
    show: options.show ?? true
  });

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
  latestWindow = window;
  startupDiagnostics.registerWindow(window);

  if (process.env.VITE_DEV_SERVER_URL) {
    await startupDiagnostics.mark('main:before-load-url', {
      url: process.env.VITE_DEV_SERVER_URL
    });
    await window.loadURL(process.env.VITE_DEV_SERVER_URL);
    await startupDiagnostics.mark('main:after-load-url');
  } else {
    const rendererPath = join(currentDirectory, '../../renderer/index.html');
    await startupDiagnostics.mark('main:before-load-file', {
      path: rendererPath
    });
    await window.loadFile(rendererPath);
    await startupDiagnostics.mark('main:after-load-file');
  }

  window.on('closed', () => {
    if (latestWindow === window) {
      latestWindow = null;
    }
  });

  return window;
}

async function runPackagedSmokeTest(): Promise<void> {
  await startupDiagnostics.mark('smoke:before-renderer-access-check');
  await access(join(currentDirectory, '../../renderer/index.html'));
  await startupDiagnostics.mark('smoke:after-renderer-access-check');
  const window = await createMainWindow({ show: false });
  await startupDiagnostics.mark('smoke:window-created');
  window.destroy();
  await startupDiagnostics.mark('smoke:window-destroyed');
}

async function runApplication(): Promise<void> {
  await startupDiagnostics.mark('main:before-app-when-ready');
  await app.whenReady();
  await startupDiagnostics.mark('main:after-app-when-ready');

  if (process.env.BOCHKI_SMOKE_TEST === '1') {
    await runPackagedSmokeTest();
    return;
  }

  await createMainWindow();
  await startupDiagnostics.mark('main:initial-window-created');

  app.on('activate', () => {
    void startupDiagnostics.mark('app:activate');

    if (BrowserWindow.getAllWindows().length === 0) {
      void createMainWindow();
    }
  });
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

await startupDiagnostics.mark('process:entry', {
  diagnostic: startupDiagnostics.isEnabled,
  smoke: process.env.BOCHKI_SMOKE_TEST === '1'
});

if (process.env.BOCHKI_SMOKE_TEST === '1') {
  try {
    await withTimeout(runApplication(), SMOKE_TEST_TIMEOUT_MS);
    await startupDiagnostics.mark('smoke:completed');
    await startupDiagnostics.flush();
    app.exit(0);
  } catch (error) {
    await startupDiagnostics.mark('smoke:failed', {
      message: error instanceof Error ? error.message : String(error)
    });
    await startupDiagnostics.captureWindow(latestWindow, 'smoke-failed');
    await startupDiagnostics.flush();
    console.error('Packaged smoke test failed.', error);
    app.exit(1);
  }
} else {
  await runApplication();
}

app.on('window-all-closed', () => {
  void startupDiagnostics.mark('app:window-all-closed', {
    platform: process.platform
  });

  if (process.platform !== 'darwin') {
    app.quit();
  }
});
