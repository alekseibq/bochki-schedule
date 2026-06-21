import { mkdirSync } from 'node:fs';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const desktopRoot = fileURLToPath(new URL('../', import.meta.url));
const qaDataDirectory = fileURLToPath(
  new URL('../../../.tmp/desktop-qa-data', import.meta.url)
);
const devScriptPath = fileURLToPath(new URL('./dev.mjs', import.meta.url));

mkdirSync(qaDataDirectory, { recursive: true });

const child = spawn(process.execPath, [devScriptPath], {
  cwd: desktopRoot,
  stdio: 'inherit',
  env: {
    ...process.env,
    BOCHKI_DATA_DIR: qaDataDirectory
  }
});

child.on('exit', (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }

  process.exit(code ?? 0);
});
