import { execFile } from 'node:child_process';
import { constants as fsConstants } from 'node:fs';
import { access, readdir, stat } from 'node:fs/promises';
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
await assertPackagedPayload(apps[0]);
await assertDmgExists(expectedArch);
