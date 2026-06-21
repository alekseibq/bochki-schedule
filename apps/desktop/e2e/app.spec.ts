import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { _electron as electron, expect, test } from '@playwright/test';

const currentDirectory = dirname(fileURLToPath(import.meta.url));
const desktopRoot = resolve(currentDirectory, '..');

test.skip(
  process.platform !== 'darwin',
  'Electron smoke runs on macOS CI for this macOS app.'
);

test('opens dictionary sections from the top menu', async () => {
  const userDataDirectory = await mkdtemp(join(tmpdir(), 'bochki-e2e-'));
  const app = await electron.launch({
    args: [desktopRoot],
    env: {
      ...process.env,
      BOCHKI_DATA_DIR: userDataDirectory
    }
  });

  const page = await app.firstWindow();
  await expect(page.getByTestId('home-page')).toBeVisible();

  await page.getByText('Справочники').click();
  await page.getByText('Участники').click();
  await expect(page.getByTestId('participants-page')).toBeVisible();

  await page.getByText('Справочники').click();
  await page.getByText('Сопровождающие').click();
  await expect(page.getByTestId('trainers-page')).toBeVisible();

  await app.close();
});
