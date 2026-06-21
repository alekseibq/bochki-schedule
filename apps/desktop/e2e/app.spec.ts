import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { spawn } from 'node:child_process';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import electronPath from 'electron';
import { expect, test } from '@playwright/test';

const currentDirectory = dirname(fileURLToPath(import.meta.url));
const desktopRoot = resolve(currentDirectory, '..');

test.skip(
  process.platform !== 'darwin' && process.env.CI !== 'true',
  'Electron smoke runs on macOS locally or under Linux CI with xvfb.'
);

test('opens dictionary sections from the top menu', async () => {
  const userDataDirectory = await mkdtemp(join(tmpdir(), 'bochki-e2e-'));
  const result = await runElectronSmoke(userDataDirectory);

  expect(result.output).toContain('[e2e] renderer self-test passed');
  expect(result.exitCode).toBe(0);
});

async function runElectronSmoke(
  userDataDirectory: string
): Promise<{ exitCode: number | null; output: string }> {
  const child = spawn(electronPath, ['--no-sandbox', desktopRoot], {
    env: {
      ...process.env,
      BOCHKI_DATA_DIR: userDataDirectory,
      BOCHKI_E2E_SELF_TEST: '1'
    },
    stdio: ['ignore', 'pipe', 'pipe']
  });

  let output = '';
  child.stdout.on('data', (chunk: Buffer) => {
    output += chunk.toString();
  });
  child.stderr.on('data', (chunk: Buffer) => {
    output += chunk.toString();
  });

  const exitCode = await new Promise<number | null>((resolve, reject) => {
    const timeout = setTimeout(() => {
      child.kill('SIGTERM');
      reject(new Error(`Electron smoke timed out. Output:\n${output}`));
    }, 20_000);

    child.on('error', (error) => {
      clearTimeout(timeout);
      reject(error);
    });
    child.on('exit', (code) => {
      clearTimeout(timeout);
      resolve(code);
    });
  });

  return { exitCode, output };
}
