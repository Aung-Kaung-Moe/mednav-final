import { test, expect } from '@playwright/test';

test('sidebar opens the decision-engine investigation and medical inventory', async ({ page }) => {
  await page.goto('/');
  const nav = page.getByRole('navigation', { name: 'Main navigation' });
  await nav.getByRole('button', { name: 'Investigation' }).click();
  const investigation = page.getByTestId('iterative-investigation');
  await expect(investigation.getByRole('heading', { name: /Crew A · Health Investigation/ })).toBeVisible();
  await expect(investigation.getByRole('complementary', { name: 'Possible causes and snapshot' })).toBeVisible();
  await expect(page.getByText('Quick Test Scenarios')).toHaveCount(0);
  await investigation.getByRole('button', { name: 'View Medical Inventory' }).click();

  await expect(page.getByRole('heading', { name: 'Onboard Medical Inventory & Medications' })).toBeVisible();
  await page.getByLabel('Search medications').fill('acetaminophen');
  const row = page.locator('.inv-med-inventory-row');
  await expect(row).toHaveCount(1);
  await page.getByRole('button', { name: 'Adjust Stock' }).click();
  await expect(row.getByRole('spinbutton')).toBeVisible();
  await expect(row.getByRole('button', { name: /Save Acetaminophen/i })).toBeDisabled();
  await page.getByRole('button', { name: 'Done Adjusting' }).click();
  await expect(row.getByRole('spinbutton')).toHaveCount(0);
});
