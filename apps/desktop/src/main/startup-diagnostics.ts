import { appendFile, mkdir, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { tmpdir } from 'node:os';
import type { App, BrowserWindow } from 'electron';

interface StartupDiagnosticsOptions {
  enabled: boolean;
  logPath: string;
  metadataPath: string;
  screenshotPath: string;
}

interface StartupPhaseRecord {
  at: string;
  detail?: Record<string, string | number | boolean | null>;
  phase: string;
}

interface StartupMetadata {
  context: Record<string, string | number | boolean | null>;
  lastPhase: string | null;
  phases: StartupPhaseRecord[];
  screenshotPath: string;
}

export interface StartupDiagnostics {
  recordContext: (
    detail: Record<string, string | number | boolean | null>
  ) => Promise<void>;
  captureWindow: (
    window: BrowserWindow | null,
    reason: string
  ) => Promise<void>;
  flush: () => Promise<void>;
  isEnabled: boolean;
  mark: (
    phase: string,
    detail?: Record<string, string | number | boolean | null>
  ) => Promise<void>;
  registerApp: (app: App) => void;
  registerWindow: (window: BrowserWindow) => void;
  resolvePaths: () => StartupDiagnosticsOptions;
  startHeartbeat: (intervalMs: number) => void;
}

export function createStartupDiagnostics(): StartupDiagnostics {
  const options = resolveOptions();
  const metadata: StartupMetadata = {
    context: {},
    lastPhase: null,
    phases: [],
    screenshotPath: options.screenshotPath
  };
  let writeQueue = Promise.resolve();

  installProcessHandlers(mark);

  return {
    recordContext,
    captureWindow,
    flush,
    isEnabled: options.enabled,
    mark,
    registerApp,
    registerWindow,
    resolvePaths: () => options,
    startHeartbeat
  };

  async function mark(
    phase: string,
    detail?: Record<string, string | number | boolean | null>
  ): Promise<void> {
    if (!options.enabled) {
      return;
    }

    const record: StartupPhaseRecord = {
      at: new Date().toISOString(),
      detail,
      phase
    };

    metadata.lastPhase = phase;
    metadata.phases.push(record);

    const logLine = `${record.at} ${phase}${detail ? ` ${JSON.stringify(detail)}` : ''}\n`;
    process.stderr.write(
      `[bochki-startup] ${phase}${detail ? ` ${JSON.stringify(detail)}` : ''}\n`
    );

    queueWrite(async () => {
      await ensureParentDirectories(options.logPath, options.metadataPath);
      await appendFile(options.logPath, logLine, 'utf8');
      await writeFile(
        options.metadataPath,
        `${JSON.stringify(metadata, null, 2)}\n`,
        'utf8'
      );
    });

    await flush();
  }

  function registerWindow(window: BrowserWindow): void {
    if (!options.enabled) {
      return;
    }

    void mark('main:window-created', {
      show: window.isVisible()
    });

    window.on('ready-to-show', () => {
      void mark('main:window-ready-to-show');
    });
    window.on('show', () => {
      void mark('main:window-show');
    });
    window.on('unresponsive', () => {
      void mark('main:window-unresponsive');
    });
    window.on('responsive', () => {
      void mark('main:window-responsive');
    });
    window.on('closed', () => {
      void mark('main:window-closed');
    });

    window.webContents.on('dom-ready', () => {
      void mark('webcontents:dom-ready');
    });
    window.webContents.on('did-start-loading', () => {
      void mark('webcontents:did-start-loading');
    });
    window.webContents.on('did-stop-loading', () => {
      void mark('webcontents:did-stop-loading');
    });
    window.webContents.on('did-finish-load', () => {
      void mark('webcontents:did-finish-load');
    });
    window.webContents.on(
      'did-fail-load',
      (_event, errorCode, errorDescription, validatedURL, isMainFrame) => {
        void mark('webcontents:did-fail-load', {
          errorCode,
          errorDescription,
          isMainFrame,
          validatedURL
        });
      }
    );
    window.webContents.on(
      'render-process-gone',
      (_event, details: { reason: string; exitCode: number }) => {
        void mark('webcontents:render-process-gone', {
          exitCode: details.exitCode,
          reason: details.reason
        });
      }
    );
    window.webContents.on(
      'console-message',
      (_event, level, message, lineNumber, sourceId) => {
        void mark('webcontents:console-message', {
          level,
          lineNumber,
          message,
          sourceId
        });
      }
    );
  }

  function registerApp(app: App): void {
    if (!options.enabled) {
      return;
    }

    app.on('will-finish-launching', () => {
      void mark('app:will-finish-launching');
    });
    app.on('ready', () => {
      void mark('app:ready');
    });
    app.on('open-file', (_event, path) => {
      void mark('app:open-file', { path });
    });
    app.on('open-url', (_event, url) => {
      void mark('app:open-url', { url });
    });
    app.on('activate', () => {
      void mark('app:activate');
    });
    app.on('gpu-info-update', () => {
      void mark('app:gpu-info-update');
    });
    app.on('child-process-gone', (_event, details) => {
      void mark('app:child-process-gone', {
        exitCode: details.exitCode,
        name: details.name ?? null,
        reason: details.reason,
        serviceName:
          'serviceName' in details ? (details.serviceName ?? null) : null,
        type: details.type ?? null
      });
    });
    app.on('browser-window-created', () => {
      void mark('app:browser-window-created');
    });
    app.on('window-all-closed', () => {
      void mark('app:window-all-closed');
    });
  }

  function startHeartbeat(intervalMs: number): void {
    if (!options.enabled) {
      return;
    }

    const interval = setInterval(() => {
      void mark('process:heartbeat', {
        pid: process.pid,
        uptimeSeconds: Math.round(process.uptime())
      });
    }, intervalMs);

    interval.unref();
  }

  async function recordContext(
    detail: Record<string, string | number | boolean | null>
  ): Promise<void> {
    if (!options.enabled) {
      return;
    }

    metadata.context = {
      ...metadata.context,
      ...detail
    };

    queueWrite(async () => {
      await ensureParentDirectories(options.metadataPath);
      await writeFile(
        options.metadataPath,
        `${JSON.stringify(metadata, null, 2)}\n`,
        'utf8'
      );
    });

    await flush();
  }

  async function captureWindow(
    window: BrowserWindow | null,
    reason: string
  ): Promise<void> {
    if (!options.enabled) {
      return;
    }

    if (!window || window.isDestroyed()) {
      await mark('main:screenshot-skipped', {
        reason: `${reason}:window-missing`
      });
      return;
    }

    try {
      const image = await window.webContents.capturePage();
      await ensureParentDirectories(options.screenshotPath);
      await writeFile(options.screenshotPath, image.toPNG());
      await mark('main:screenshot-captured', {
        path: options.screenshotPath,
        reason
      });
    } catch (error) {
      await mark('main:screenshot-failed', {
        message: serializeError(error),
        reason
      });
    }
  }

  async function flush(): Promise<void> {
    await writeQueue;
  }

  function queueWrite(operation: () => Promise<void>): void {
    writeQueue = writeQueue.then(operation, operation);
  }
}

function installProcessHandlers(
  mark: (
    phase: string,
    detail?: Record<string, string | number | boolean | null>
  ) => Promise<void>
): void {
  process.on('uncaughtExceptionMonitor', (error) => {
    void mark('process:uncaught-exception', {
      message: serializeError(error)
    });
  });

  process.on('unhandledRejection', (reason) => {
    void mark('process:unhandled-rejection', {
      message: serializeError(reason)
    });
  });
}

function resolveOptions(): StartupDiagnosticsOptions {
  const enabled =
    process.env.BOCHKI_STARTUP_DIAGNOSTIC === '1' ||
    process.env.BOCHKI_SMOKE_TEST === '1';
  const baseDirectory = join(tmpdir(), 'bochki-startup-diagnostics');
  const logPath =
    process.env.BOCHKI_STARTUP_LOG_PATH ??
    join(baseDirectory, 'bochki-startup.log');
  const metadataPath =
    process.env.BOCHKI_STARTUP_METADATA_PATH ??
    join(baseDirectory, 'bochki-startup.json');
  const screenshotPath =
    process.env.BOCHKI_STARTUP_SCREENSHOT_PATH ??
    join(baseDirectory, 'bochki-startup.png');

  return {
    enabled,
    logPath,
    metadataPath,
    screenshotPath
  };
}

async function ensureParentDirectories(...paths: string[]): Promise<void> {
  await Promise.all(
    paths.map((path) => mkdir(dirname(path), { recursive: true }))
  );
}

function serializeError(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }

  return String(error);
}
