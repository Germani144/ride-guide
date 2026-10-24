import { test, expect } from './fixtures.mjs';

test('add a car through the wizard and save it as my car', async ({ page, app }) => {
  await app.open('#/new');
  await expect(page.getByRole('heading', { name: 'What will this car really cost you?' })).toBeVisible();
  await expect(page.locator('.step-count')).toHaveText('Step 1 of 7');

  await page.getByRole('button', { name: /Not yet/ }).click();
  await page.locator('#f-name').fill('Test Hatchback');
  await page.locator('#f-year').fill('2026');
  await page.getByRole('radio', { name: 'Petrol' }).click();
  await page.getByRole('button', { name: 'Next' }).click();

  await page.getByRole('button', { name: /Pay upfront/ }).click();
  await expect(page.getByRole('heading', { name: 'What does it cost?' })).toBeVisible();
  // Leaving the price empty is not allowed.
  await page.getByRole('button', { name: 'Next' }).click();
  await expect(page.locator('#err-price')).toHaveText('Fill this in to continue.');
  await page.locator('#f-price').fill('250.000');
  await page.getByRole('button', { name: 'Next' }).click();

  await page.locator('#f-kmPerUnit').fill('16');
  await page.getByRole('button', { name: 'Next' }).click();

  await page.locator('#f-insuranceMo').fill('500');
  await page.locator('#f-greenTaxMo').fill('1200'); // per half year
  await page.getByRole('button', { name: 'Next' }).click();

  await expect(page.getByRole('heading', { name: 'Here is what it costs' })).toBeVisible();
  await expect(page.locator('.price-num')).toHaveText('7.04');
  await expect(page.locator('.price-month-num')).toHaveText('5,863');
  await expect(page.locator('.facts').first()).toContainText('250,000 kr');

  await page.getByRole('button', { name: 'Save as my car' }).click();
  await expect(page.locator('.toast')).toHaveText('Saved to your garage');
  await expect(page.getByRole('heading', { name: 'Test Hatchback' })).toBeVisible();
  await app.saved();
  const car = (await app.state()).cars[0];
  expect(car).toMatchObject({ name: 'Test Hatchback', method: 'cash', price: 250000, mine: true, greenTaxMo: 200 });

  await page.locator('#tabs').getByRole('link', { name: 'Garage' }).click();
  await expect(page.locator('.rows li')).toHaveCount(1);
  await expect(page.locator('.row-name')).toHaveText('Test Hatchback');
});

test('a lease asks its own terms and switches', async ({ page, app }) => {
  await app.open('#/new');
  await page.getByRole('button', { name: /Not yet/ }).click();
  await page.locator('#f-name').fill('Lease Car');
  await page.getByRole('button', { name: 'Next' }).click();
  await page.getByRole('button', { name: /^Lease/ }).click();
  await expect(page.getByRole('heading', { name: 'What are the lease terms?' })).toBeVisible();
  await expect(page.locator('#s-serviceIncluded')).toBeChecked();
  await expect(page.locator('#s-tyresIncluded')).not.toBeChecked();
  await page.locator('#f-leaseMo').fill('3000');
  await page.locator('#f-yearsOfUse').fill('3');
  await page.getByRole('button', { name: 'Next' }).click();
  await page.locator('#f-kmPerUnit').fill('15');
  await page.getByRole('button', { name: 'Next' }).click();
  // With service in the lease, maintenance is not asked.
  await expect(page.locator('#s-maintenanceAuto')).toHaveCount(0);
  await page.getByRole('button', { name: 'Next' }).click();
  await expect(page.locator('.price-num')).toHaveText('5.00');
});
