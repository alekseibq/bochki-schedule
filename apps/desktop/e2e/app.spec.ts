import { expect, test } from '@playwright/test';

test.skip(
  process.platform === 'linux' && process.env.CI !== 'true',
  'Renderer E2E runs in Linux CI where Playwright browsers are installed.'
);

test('opens dictionary sections from the top menu', async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(window, 'bochki', {
      configurable: true,
      value: {
        data: {
          load: async () => ({
            createdFromEmpty: false,
            document: {
              schemaVersion: 2,
              dictionaries: {
                participants: [],
                trainers: [],
                procedureTypes: []
              },
              seminars: []
            }
          })
        }
      }
    });
  });

  await page.goto('/');
  await expect(page.getByTestId('home-page')).toBeVisible();

  await page.getByText('Справочники', { exact: true }).hover();
  await page.getByText('Справочники', { exact: true }).click();
  await page.getByText('Участники', { exact: true }).click();
  await expect(page.getByTestId('participants-page')).toBeVisible();

  await page.getByText('Справочники', { exact: true }).hover();
  await page.getByText('Справочники', { exact: true }).click();
  await page.getByText('Сопровождающие', { exact: true }).click();
  await expect(page.getByTestId('trainers-page')).toBeVisible();
});
