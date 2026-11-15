import { test, expect } from '@playwright/test';

test('mission question and inventory controls use the live decision engine', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Investigation', exact: true }).click();
  const investigation = page.getByTestId('iterative-investigation');
  await expect(investigation).toBeVisible();

  await investigation.getByText('Quick Test Scenarios').click();
  await page.getByRole('button', { name: 'High HR 112 (Exercise vs Illness)' }).click();
  await page.getByRole('button', { name: 'Yes, I just worked out' }).click();
  await expect(investigation).toContainText('How long will your crew remain in space');
  await page.getByPlaceholder('e.g. 60').fill('60');
  await page.getByRole('button', { name: '~45 days (Medium mission)' }).click();
  await expect(investigation).toHaveAttribute('data-status', 'completed');
  await expect(investigation.getByRole('spinbutton', { name: 'Mission Days Left:' })).toHaveValue('45');

  await investigation.getByRole('button', { name: 'Medical Inventory', exact: true }).click();
  await expect(page.locator('.inv-med-inventory-row').first()).toBeVisible();
  await page.getByPlaceholder('Filter by name…').fill('acetaminophen');
  await expect(page.locator('.inv-med-inventory-row')).toHaveCount(1);
  await expect(page.getByRole('button', { name: /Edit Acetaminophen/i })).toHaveCount(0);
  await page.getByRole('button', { name: 'Adjust Stock' }).click();
  await expect(page.getByRole('button', { name: /Edit Acetaminophen/i })).toBeVisible();
});
