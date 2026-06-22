import { execFile, spawn } from 'node:child_process';
import { once } from 'node:events';
import { constants as fsConstants } from 'node:fs';
import { access, mkdir, readdir, stat, writeFile } from 'node:fs/promises';
import { basename, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);
const desktopRoot = fileURLToPath(new URL('../', import.meta.url));
const releaseDirectory = join(desktopRoot, 'release');

const archAliases = {
  arm64: 'arm64',
  x64: 'x86_64'
};

function getExpectedArch() {
  const archIndex = process.argv.indexOf('--arch');

  if (archIndex === -1) {
    return process.env.BOCHKI_EXPECTED_ARCH;
  }

  return process.argv[archIndex + 1];
}

function getStartupVariant() {
  const variantIndex = process.argv.indexOf('--variant');

  if (variantIndex === -1) {
    return process.env.BOCHKI_STARTUP_VARIANT ?? 'ultra-minimal';
  }

  return process.argv[variantIndex + 1];
}

async function findApps(directory, depth = 0) {
  if (depth > 3) {
    return [];
  }

  const entries = await readdir(directory, { withFileTypes: true });
  const apps = [];

  for (const entry of entries) {
    if (!entry.isDirectory()) {
      continue;
    }

    const entryPath = join(directory, entry.name);

    if (entry.name.endsWith('.app')) {
      apps.push(entryPath);
      continue;
    }

    apps.push(...(await findApps(entryPath, depth + 1)));
  }

  return apps;
}

async function resolveExecutable(appPath) {
  const macOsDirectory = join(appPath, 'Contents', 'MacOS');
  const entries = await readdir(macOsDirectory);

  for (const entry of entries) {
    const executablePath = join(macOsDirectory, entry);
    const executableStat = await stat(executablePath);

    if (executableStat.isFile() && (executableStat.mode & 0o111) !== 0) {
      return executablePath;
    }
  }

  throw new Error(`No executable file found in ${macOsDirectory}`);
}

async function assertExecutableArch(executablePath, expectedArch) {
  const expectedLipoArch = archAliases[expectedArch];

  if (!expectedLipoArch) {
    throw new Error(`Unsupported expected architecture: ${expectedArch}`);
  }

  const { stdout } = await execFileAsync('lipo', ['-archs', executablePath]);
  const actualArchs = stdout.trim().split(/\s+/);

  if (!actualArchs.includes(expectedLipoArch)) {
    throw new Error(
      `Expected ${basename(executablePath)} to include ${expectedLipoArch}, got ${actualArchs.join(', ')}`
    );
  }
}

async function assertPackagedPayload(appPath) {
  const infoPlistPath = join(appPath, 'Contents', 'Info.plist');
  const appAsarPath = join(appPath, 'Contents', 'Resources', 'app.asar');

  await access(infoPlistPath, fsConstants.R_OK);
  await access(appAsarPath, fsConstants.R_OK);

  const appAsarStat = await stat(appAsarPath);

  if (!appAsarStat.isFile() || appAsarStat.size === 0) {
    throw new Error(`Invalid packaged app payload: ${appAsarPath}`);
  }
}

async function assertDmgExists(expectedArch) {
  const entries = await readdir(releaseDirectory);
  const expectedSuffix = `-mac-${expectedArch}.dmg`;
  const dmg = entries.find((entry) => entry.endsWith(expectedSuffix));

  if (!dmg) {
    throw new Error(
      `No DMG ending with ${expectedSuffix} found in ${releaseDirectory}.`
    );
  }

  const dmgPath = join(releaseDirectory, dmg);
  const dmgStat = await stat(dmgPath);

  if (!dmgStat.isFile() || dmgStat.size === 0) {
    throw new Error(`Invalid DMG artifact: ${dmgPath}`);
  }
}

function resolveDiagnosticsPaths(expectedArch, startupVariant) {
  const diagnosticsDirectory = join(
    releaseDirectory,
    'diagnostics',
    expectedArch,
    startupVariant
  );

  return {
    appleEventsLogPath: join(diagnosticsDirectory, 'log-appleevents.txt'),
    childStatePath: join(diagnosticsDirectory, 'child-state.json'),
    diagnosticsDirectory,
    launchErrorPath: join(diagnosticsDirectory, 'launch-error.txt'),
    launchServicesLogPath: join(diagnosticsDirectory, 'log-launchservices.txt'),
    launchctlPath: join(diagnosticsDirectory, 'launchctl-print.txt'),
    lsappinfoInfoPath: join(diagnosticsDirectory, 'lsappinfo-info.txt'),
    lsappinfoListPath: join(diagnosticsDirectory, 'lsappinfo-list.txt'),
    metadataPath: join(diagnosticsDirectory, 'startup-metadata.json'),
    processListPath: join(diagnosticsDirectory, 'ps.txt'),
    samplePath: join(diagnosticsDirectory, 'sample.txt'),
    screenshotMissingPath: join(diagnosticsDirectory, 'screenshot-missing.txt'),
    screenshotPath: join(diagnosticsDirectory, 'startup-screenshot.png'),
    spindumpPath: join(diagnosticsDirectory, 'spindump.txt'),
    startupLogPath: join(diagnosticsDirectory, 'startup-log.txt'),
    stderrPath: join(diagnosticsDirectory, 'stderr.txt'),
    stdoutPath: join(diagnosticsDirectory, 'stdout.txt')
  };
}

async function writeDiagnosticFile(path, content) {
  await writeFile(path, content, 'utf8');
}

async function assertPackagedAppLaunches(
  executablePath,
  expectedArch,
  startupVariant
) {
  const diagnostics = resolveDiagnosticsPaths(expectedArch, startupVariant);
  await mkdir(diagnostics.diagnosticsDirectory, { recursive: true });

  const env = {
    ...process.env,
    BOCHKI_SMOKE_TEST: '1',
    BOCHKI_STARTUP_DIAGNOSTIC: '1',
    BOCHKI_STARTUP_LOG_PATH: diagnostics.startupLogPath,
    BOCHKI_STARTUP_METADATA_PATH: diagnostics.metadataPath,
    BOCHKI_STARTUP_SCREENSHOT_PATH: diagnostics.screenshotPath,
    BOCHKI_STARTUP_VARIANT: startupVariant
  };

  const child = spawn(executablePath, [], {
    env,
    stdio: ['ignore', 'pipe', 'pipe']
  });

  let stdout = '';
  let stderr = '';
  let timeoutTriggered = false;

  child.stdout.on('data', (chunk) => {
    stdout += chunk.toString();
  });

  child.stderr.on('data', (chunk) => {
    stderr += chunk.toString();
  });

  try {
    const exit = await waitForChild(child, diagnostics, 30_000, () => {
      timeoutTriggered = true;
      return captureSystemDiagnostics(child.pid, diagnostics);
    });

    await writeDiagnosticFile(diagnostics.stdoutPath, stdout);
    await writeDiagnosticFile(diagnostics.stderrPath, stderr);

    if (exit.code !== 0 || exit.signal) {
      const details = [];

      if (exit.code !== null) {
        details.push(`code=${String(exit.code)}`);
      }

      if (exit.signal) {
        details.push(`signal=${String(exit.signal)}`);
      }

      if (stderr) {
        details.push(`stderr=${stderr.trim()}`);
      }

      throw new Error(
        `Packaged app failed to launch in smoke mode: exited unexpectedly${details.length > 0 ? ` (${details.join('; ')})` : ''}`
      );
    }
  } catch (error) {
    const details = [];

    if (error && typeof error === 'object') {
      if ('code' in error && error.code) {
        details.push(`code=${String(error.code)}`);
      }

      if ('signal' in error && error.signal) {
        details.push(`signal=${String(error.signal)}`);
      }

      if ('killed' in error && error.killed) {
        details.push('killed=true');
      }

      if (
        'stdout' in error &&
        typeof error.stdout === 'string' &&
        error.stdout
      ) {
        stdout = error.stdout;
        details.push(`stdout=${error.stdout.trim()}`);
      }

      if (
        'stderr' in error &&
        typeof error.stderr === 'string' &&
        error.stderr
      ) {
        stderr = error.stderr;
        details.push(`stderr=${error.stderr.trim()}`);
      }
    }

    await writeDiagnosticFile(diagnostics.stdoutPath, stdout);
    await writeDiagnosticFile(diagnostics.stderrPath, stderr);
    await writeDiagnosticFile(
      diagnostics.launchErrorPath,
      `${error instanceof Error ? (error.stack ?? error.message) : String(error)}\n`
    );

    if (timeoutTriggered) {
      details.push('timeout=true');
    }

    throw new Error(
      `Packaged app failed to launch in smoke mode: ${error instanceof Error ? error.message : String(error)}${details.length > 0 ? ` (${details.join('; ')})` : ''}`
    );
  } finally {
    try {
      await access(diagnostics.screenshotPath, fsConstants.R_OK);
    } catch {
      await writeDiagnosticFile(
        diagnostics.screenshotMissingPath,
        'No screenshot was captured during startup diagnostics.\n'
      );
    }
  }
}

async function waitForChild(child, diagnostics, timeoutMs, onTimeout) {
  let timeout;

  try {
    return await Promise.race([
      once(child, 'exit').then(([code, signal]) => ({ code, signal })),
      once(child, 'error').then(([error]) => {
        throw error;
      }),
      new Promise((resolve, reject) => {
        timeout = setTimeout(async () => {
          try {
            await onTimeout();
            await terminateChild(child);
            reject(new Error(`Timed out after ${timeoutMs}ms.`));
          } catch (error) {
            reject(error);
          }
        }, timeoutMs);
      })
    ]);
  } finally {
    if (timeout) {
      globalThis.clearTimeout(timeout);
    }

    await writeDiagnosticFile(
      diagnostics.childStatePath,
      `${JSON.stringify(
        {
          killed: child.killed,
          pid: child.pid,
          spawnfile: child.spawnfile,
          spawnargs: child.spawnargs
        },
        null,
        2
      )}\n`
    );
  }
}

async function terminateChild(child) {
  if (child.exitCode !== null || child.signalCode !== null) {
    return;
  }

  child.kill('SIGTERM');

  try {
    await Promise.race([
      once(child, 'exit'),
      new Promise((resolve) => setTimeout(resolve, 5_000))
    ]);
  } catch {
    // Ignore and escalate to SIGKILL below.
  }

  if (child.exitCode === null && child.signalCode === null) {
    child.kill('SIGKILL');
  }
}

async function captureSystemDiagnostics(pid, diagnostics) {
  if (!pid || process.platform !== 'darwin') {
    return;
  }

  const uid =
    typeof process.getuid === 'function' ? String(process.getuid()) : '';

  await Promise.all([
    runDiagnosticCommand(
      'ps',
      ['-p', String(pid), '-o', 'pid,ppid,stat,time,command'],
      diagnostics.processListPath
    ),
    runDiagnosticCommand(
      'lsappinfo',
      ['info', '-only', 'pid', String(pid)],
      diagnostics.lsappinfoInfoPath
    ),
    runDiagnosticCommand('lsappinfo', ['list'], diagnostics.lsappinfoListPath),
    runDiagnosticCommand(
      'sample',
      [String(pid), '3', '-mayDie'],
      diagnostics.samplePath,
      { timeoutMs: 10_000 }
    ),
    runDiagnosticCommand(
      'spindump',
      [String(pid), '5', '5'],
      diagnostics.spindumpPath,
      { timeoutMs: 20_000 }
    ),
    runDiagnosticCommand(
      'launchctl',
      uid
        ? ['print', `gui/${uid}/com.apple.coreservices.launchservicesd`]
        : ['print', 'system/com.apple.coreservices.launchservicesd'],
      diagnostics.launchctlPath,
      { timeoutMs: 10_000 }
    ),
    runDiagnosticCommand(
      'log',
      [
        'show',
        '--last',
        '5m',
        '--style',
        'compact',
        '--predicate',
        'subsystem == "com.apple.launchservices"'
      ],
      diagnostics.launchServicesLogPath,
      { timeoutMs: 15_000 }
    ),
    runDiagnosticCommand(
      'log',
      [
        'show',
        '--last',
        '5m',
        '--style',
        'compact',
        '--predicate',
        'subsystem == "com.apple.appleevents"'
      ],
      diagnostics.appleEventsLogPath,
      { timeoutMs: 15_000 }
    )
  ]);
}

async function runDiagnosticCommand(command, args, outputPath, options = {}) {
  try {
    const result = await execFileAsync(command, args, {
      timeout: options.timeoutMs ?? 10_000
    });
    await writeDiagnosticFile(
      outputPath,
      `${formatCommand(command, args)}\n${result.stdout}${result.stderr}`
    );
  } catch (error) {
    await writeDiagnosticFile(
      outputPath,
      `${formatCommand(command, args)}\n${error instanceof Error ? (error.stack ?? error.message) : String(error)}\n${readExecOutput(error)}`
    );
  }
}

function formatCommand(command, args) {
  return `$ ${command} ${args.join(' ')}\n`;
}

function readExecOutput(error) {
  if (!error || typeof error !== 'object') {
    return '';
  }

  const stdout =
    'stdout' in error && typeof error.stdout === 'string' ? error.stdout : '';
  const stderr =
    'stderr' in error && typeof error.stderr === 'string' ? error.stderr : '';

  return `${stdout}${stderr}`;
}

const expectedArch = getExpectedArch();
const startupVariant = getStartupVariant();

if (!expectedArch) {
  throw new Error('Expected architecture is required. Pass --arch x64|arm64.');
}

await access(releaseDirectory, fsConstants.R_OK);

const apps = await findApps(releaseDirectory);

if (apps.length !== 1) {
  throw new Error(
    `Expected exactly one packaged .app in ${releaseDirectory}, found ${apps.length}.`
  );
}

const executablePath = await resolveExecutable(apps[0]);
await assertExecutableArch(executablePath, expectedArch);
await assertPackagedPayload(apps[0]);
await assertDmgExists(expectedArch);
await assertPackagedAppLaunches(executablePath, expectedArch, startupVariant);
