import { app } from 'electron';
import { createStartupDiagnostics } from './startup-diagnostics.js';

const SMOKE_TEST_TIMEOUT_MS = 15_000;
const HEARTBEAT_INTERVAL_MS = 1_000;
const startupDiagnostics = createStartupDiagnostics();
const startupVariant = process.env.BOCHKI_STARTUP_VARIANT ?? 'ultra-minimal';

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

async function runPackagedSmokeTest(): Promise<void> {
  await startupDiagnostics.mark('smoke:ultra-minimal-no-window');
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

  await startupDiagnostics.mark('main:ultra-minimal-ready');
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
  startupSwitches: '',
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
});
