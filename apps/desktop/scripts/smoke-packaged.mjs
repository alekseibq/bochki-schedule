import { execFile } from 'node:child_process';
import { constants as fsConstants } from 'node:fs';
import { access, mkdtemp, readdir, rm, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { basename, join } from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);
const desktopRoot = fileURLToPath(new URL('../', import.meta.url));
const releaseDirectory = join(desktopRoot, 'release');
const smokeTimeoutMs = 20_000;

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

async function runSmokeExecutable(executablePath) {
  const dataDirectory = await mkdtemp(join(tmpdir(), 'bochki-smoke-data-'));

  try {
    await new Promise((resolve, reject) => {
      const child = spawn(executablePath, [], {
        env: {
          ...process.env,
          BOCHKI_DATA_DIR: dataDirectory,
          BOCHKI_SMOKE_TEST: '1'
        },
        stdio: ['ignore', 'inherit', 'inherit']
      });

      const timeout = setTimeout(() => {
        child.kill('SIGTERM');
        reject(
          new Error(`Packaged smoke test timed out after ${smokeTimeoutMs}ms.`)
        );
      }, smokeTimeoutMs);

      child.on('exit', (code, signal) => {
        globalThis.clearTimeout(timeout);

        if (code === 0) {
          resolve();
          return;
        }

        reject(
          new Error(
            `Packaged smoke test exited with ${signal ?? code ?? 'unknown'}.`
          )
        );
      });

      child.on('error', (error) => {
        globalThis.clearTimeout(timeout);
        reject(error);
      });
    });
  } finally {
    await rm(dataDirectory, { force: true, recursive: true });
  }
}

const expectedArch = getExpectedArch();

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
await runSmokeExecutable(executablePath);
