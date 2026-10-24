import { test, expect } from './fixtures.mjs';

test('settings save, survive a reload and change the costs', async ({ page, app }) => {
  await app.open('#/history');
  const before = await page.locator('.row-km').first().textContent();
  await page.getByRole('link', { name: 'Settings' }).click();
  await page.locator('#set-returnRate').fill('8');
  await page.locator('#set-returnRate').press('Enter');
  await expect(page.locator('.toast')).toHaveText('Saved');
  await page.locator('label[for="set-winterTyres"]').click();
  await app.saved();
  expect((await app.state()).settings).toMatchObject({ returnRate: 0.08, winterTyres: true });

  await page.reload();
  await page.locator('#splash').waitFor({ state: 'detached' });
  await expect(page.locator('#set-returnRate')).toHaveValue('8');
  await expect(page.locator('#set-winterTyres')).toBeChecked();
  await page.getByRole('link', { name: 'History' }).click();
  await expect(page.locator('.row-km').first()).not.toHaveText(before);
});

test('settings show the version and the update check', async ({ page, app }) => {
  await app.open('#/settings');
  const version = await page.evaluate(() => self.RIDEGUIDE_VERSION);
  await expect(page.locator('.version')).toHaveText(`RideGuide v${version}`);
  await expect(page.locator('#brand-version')).toHaveText(`v${version}`);
  page.once('dialog', async d => {
    expect(d.message()).toBe(`You're on the latest version (v${version}).`);
    await d.accept();
  });
  await page.getByRole('button', { name: 'Check for updates' }).click();
  await expect(page.getByRole('button', { name: 'Check for updates' })).toBeEnabled();
});

test('switch the language to Danish and back', async ({ page, app }) => {
  await app.open('#/settings');
  await page.getByRole('radio', { name: 'Dansk' }).click();
  await expect(page.locator('html')).toHaveAttribute('lang', 'da');
  await expect(page.getByRole('heading', { name: 'Indstillinger' })).toBeVisible();
  await expect(page.locator('#tabs')).toContainText('Ny bil');
  await expect(page.locator('#tabs')).toContainText('Historik');
  await page.reload();
  await page.locator('#splash').waitFor({ state: 'detached' });
  await expect(page.getByRole('heading', { name: 'Indstillinger' })).toBeVisible();
  await page.getByRole('link', { name: 'Historik' }).click();
  await expect(page.locator('.row-km').first()).toHaveText('5,38 kr. pr. km');
  await page.getByRole('link', { name: 'Indstillinger' }).click();
  await page.getByRole('radio', { name: 'English' }).click();
  await expect(page.locator('#tabs')).toContainText('New car');
});
