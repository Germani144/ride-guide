import { test, expect } from './fixtures.mjs';

test('the app starts offline once it has been opened', async ({ page, context, app }) => {
  await app.open('#/history');
  // Wait until the service worker controls the page and has cached the app.
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
    if (!navigator.serviceWorker.controller) {
      await new Promise(r => navigator.serviceWorker.addEventListener('controllerchange', r, { once: true }));
    }
  });
  await context.setOffline(true);
  await page.reload();
  await page.locator('#splash').waitFor({ state: 'detached' });
  await expect(page.locator('.rows li')).toHaveCount(7);
  await page.getByRole('link', { name: 'Settings' }).click();
  await expect(page.locator('.version')).toContainText('RideGuide v');
});
