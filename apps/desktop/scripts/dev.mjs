import { spawn } from 'node:child_process';
import { setTimeout as delay } from 'node:timers/promises';

const isWindows = process.platform === 'win32';
const rootCommand = 'pnpm';
const childProcesses = [];

function run(command, args, options = {}) {
  const child = isWindows
    ? spawn('cmd.exe', ['/d', '/s', '/c', command, ...args], {
        stdio: 'inherit',
        ...options
      })
    : spawn(command, args, {
        stdio: 'inherit',
        shell: false,
        ...options
      });
  childProcesses.push(child);
  return child;
}

function runChecked(command, args) {
  return new Promise((resolve, reject) => {
    const child = run(command, args);
    child.on('exit', (code) => {
      if (code === 0) {
        resolve();
        return;
      }
      reject(
        new Error(
          `${command} ${args.join(' ')} exited with ${code ?? 'unknown'}`
        )
      );
    });
  });
}

async function waitForUrl(url) {
  for (let attempt = 0; attempt < 80; attempt += 1) {
    try {
      const response = await fetch(url);
      if (response.ok) {
        return;
      }
    } catch {
      // Vite is still starting.
    }
    await delay(250);
  }
  throw new Error(`Timed out waiting for ${url}`);
}

for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => {
    for (const child of childProcesses) {
      child.kill(signal);
    }
    process.exit(0);
  });
}

await runChecked(rootCommand, ['--filter', '@bochki/domain', 'build']);
await runChecked(rootCommand, ['--filter', '@bochki/storage', 'build']);
await runChecked(rootCommand, ['--filter', '@bochki/ui', 'build']);
await runChecked(rootCommand, ['build:electron']);

const devServerUrl = 'http://localhost:5173';
run(rootCommand, ['exec', 'vite', '--host', '127.0.0.1'], {
  env: { ...process.env, FORCE_COLOR: '1' }
});
await waitForUrl(devServerUrl);

const electron = run(rootCommand, ['exec', 'electron', '.'], {
  env: {
    ...process.env,
    FORCE_COLOR: '1',
    VITE_DEV_SERVER_URL: devServerUrl
  }
});

electron.on('exit', (code) => {
  for (const child of childProcesses) {
    if (child !== electron) {
      child.kill('SIGTERM');
    }
  }
  process.exit(code ?? 0);
});
