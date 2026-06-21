import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  _electron as electron,
  expect,
  test,
  type ElectronApplication
} from '@playwright/test';

const currentDirectory = dirname(fileURLToPath(import.meta.url));
const desktopRoot = resolve(currentDirectory, '..');

test.skip(
  process.platform !== 'darwin',
  'Electron smoke runs on macOS CI for this macOS app.'
);

test('opens dictionary sections from the top menu', async () => {
  const userDataDirectory = await mkdtemp(join(tmpdir(), 'bochki-e2e-'));
  let app: ElectronApplication | undefined;

  try {
    app = await electron.launch({
      args: [desktopRoot],
      env: {
        ...process.env,
        BOCHKI_DATA_DIR: userDataDirectory
      }
    });

    const page = await app.firstWindow();
    page.on('console', (message) =>
      console.log(`[renderer:${message.type()}] ${message.text()}`)
    );
    page.on('pageerror', (error) =>
      console.error(`[renderer:pageerror] ${error.message}`)
    );

    await expect(page.getByTestId('home-page')).toBeVisible();

    await page.getByRole('menuitem', { name: 'Справочники' }).hover();
    await page.getByRole('menuitem', { name: 'Участники' }).click();
    await expect(page.getByTestId('participants-page')).toBeVisible();

    await page.getByRole('menuitem', { name: 'Справочники' }).hover();
    await page.getByRole('menuitem', { name: 'Сопровождающие' }).click();
    await expect(page.getByTestId('trainers-page')).toBeVisible();
  } finally {
    await app?.close();
  }
});
