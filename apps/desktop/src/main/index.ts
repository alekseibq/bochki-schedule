import { app, BrowserWindow } from 'electron';
import { access } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createStartupDiagnostics } from './startup-diagnostics.js';

const currentDirectory = dirname(fileURLToPath(import.meta.url));
const SMOKE_TEST_TIMEOUT_MS = 15_000;
const HEARTBEAT_INTERVAL_MS = 1_000;
const startupDiagnostics = createStartupDiagnostics();
let latestWindow: BrowserWindow | null = null;
const startupVariant = process.env.BOCHKI_STARTUP_VARIANT ?? 'baseline';

interface CreateMainWindowOptions {
  show?: boolean;
}

function applyStartupVariant(variant: string): void {
  switch (variant) {
    case 'baseline':
      return;
    case 'disable-hw-accel':
      app.disableHardwareAcceleration();
      return;
    case 'disable-gpu':
      app.commandLine.appendSwitch('disable-gpu');
      return;
    case 'disable-gpu-sandbox':
      app.commandLine.appendSwitch('disable-gpu-sandbox');
      return;
    case 'no-browser-window':
      return;
    default:
      throw new Error(`Unsupported startup variant: ${variant}`);
  }
}

function safeGetPath(name: Parameters<typeof app.getPath>[0]): string | null {
  try {
    return app.getPath(name);
  } catch {
    return null;
  }
}

function safeGetAppPath(): string | null {
  try {
    return app.getAppPath();
  } catch {
    return null;
  }
}

function resolveAppliedSwitches(variant: string): string {
  switch (variant) {
    case 'disable-gpu':
      return 'disable-gpu';
    case 'disable-gpu-sandbox':
      return 'disable-gpu-sandbox';
    default:
      return '';
  }
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
  if (startupVariant === 'no-browser-window') {
    await startupDiagnostics.mark('smoke:skip-browser-window');
    return;
  }

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
  await startupDiagnostics.recordContext({
    appPath: safeGetAppPath(),
    appReadyAfterWhenReady: app.isReady(),
    userDataPathAfterWhenReady: safeGetPath('userData')
  });

  if (process.env.BOCHKI_SMOKE_TEST === '1') {
    await runPackagedSmokeTest();
    return;
  }

  await createMainWindow();
  await startupDiagnostics.mark('main:initial-window-created');

  app.on('activate', () => {
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

startupDiagnostics.registerApp(app);
startupDiagnostics.startHeartbeat(HEARTBEAT_INTERVAL_MS);
applyStartupVariant(startupVariant);

await startupDiagnostics.mark('process:entry', {
  diagnostic: startupDiagnostics.isEnabled,
  smoke: process.env.BOCHKI_SMOKE_TEST === '1',
  variant: startupVariant
});
await startupDiagnostics.recordContext({
  appPath: safeGetAppPath(),
  appReadyAtEntry: app.isReady(),
  argv: JSON.stringify(process.argv),
  arch: process.arch,
  execPath: process.execPath,
  pid: process.pid,
  platform: process.platform,
  startupSwitches: resolveAppliedSwitches(startupVariant),
  userDataPathAtEntry: safeGetPath('userData'),
  variant: startupVariant
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
