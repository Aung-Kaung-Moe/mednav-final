import { test, expect } from '@playwright/test';

test('iterative investigation, plain questions, no arrows/safety gates, and medical inventory sync', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByTestId('engine-status')).toBeVisible();

  // Verify What-If Lab is removed from navigation
  await expect(page.getByRole('button', { name: /What-If/i })).toHaveCount(0);

  await page.getByRole('button', { name: 'Investigation', exact: true }).click();
  const inv = page.getByTestId('iterative-investigation');
  await expect(inv).toBeVisible();

  // Verify removed buttons & cluttered headers are gone
  await expect(inv.getByRole('button', { name: /Online Mode/i })).toHaveCount(0);
  await expect(inv.getByRole('button', { name: /Restart/i })).toHaveCount(0);
  await expect(inv.getByRole('button', { name: /New Form/i })).toHaveCount(0);
  await expect(inv.getByText(/I T E R A T I V E/i)).toHaveCount(0);
  await expect(inv.getByText(/Daily Data:/i)).toHaveCount(0);
  await expect(inv.getByText('POSSIBLE CAUSES')).toBeVisible();
  await expect(inv.getByText(/Updates after each answer/i)).toHaveCount(0);
  await expect(inv.getByText('DONE', { exact: true })).toHaveCount(0);

  // Quick Test 1: High HR 112 -> plain workout question (no safety gate) -> no arrow svg inside choice
  await page.getByRole('button', { name: 'Test: High HR 112 (Exercise vs Illness)' }).click();
  await expect(inv).toHaveAttribute('data-status', 'in_progress');
  const firstChoice = inv.locator('.inv-option-btn').first();
  await expect(firstChoice.locator('svg')).toHaveCount(0);

  await page.getByRole('button', { name: 'Yes, I just worked out' }).click();
  await expect(inv).toHaveAttribute('data-status', 'completed');
  await expect(inv).toContainText('Drink water and rest for 15–20 minutes');

  // Verify Astronauts Onboard control is removed
  await expect(page.getByLabel('Astronauts Onboard:')).toHaveCount(0);

  // Clicking preset (45d) must ONLY update the draft input and NOT fire mission-context request until Apply is clicked
  let missionPatchCount = 0;
  page.on('request', (req) => {
    if (req.url().includes('/investigation/mission-context') && req.method() === 'PATCH') {
      missionPatchCount += 1;
    }
  });
  await page.getByRole('button', { name: '45d', exact: true }).click();
  await expect(page.getByLabel('Remaining Days:')).toHaveValue('45');
  expect(missionPatchCount).toBe(0);

  // Set Remaining Days=70 and click Apply -> triggers crew rationing (21 reserved, 3 allocated for 4 crew)
  await page.getByLabel('Remaining Days:').fill('70');
  await page.getByRole('button', { name: 'Apply', exact: true }).click();
  await expect.poll(() => missionPatchCount).toBe(1);

  // Quick Test 2: Headache + HR 96 + Low Sleep -> rationed Acetaminophen -> Take & Deduct
  await page.getByRole('button', { name: 'Test: Headache + HR 96 + Low Sleep' }).click();
  await expect(inv).toHaveAttribute('data-status', 'in_progress');
  await page.getByRole('button', { name: 'No, I have been resting' }).click();
  await page.getByRole('button', { name: 'Yes, I drank enough water' }).click();
  await page.getByRole('button', { name: 'Normal — No fever (< 37.5 °C)' }).click();
  await page.getByRole('button', { name: 'No, I have been sleeping fine' }).click();
  await page.getByRole('button', { name: 'Bothersome — I need relief' }).click();

  await expect(inv).toHaveAttribute('data-status', 'completed');
  await expect(inv).toContainText('Acetaminophen 500 mg');
  await expect(inv.getByText(/RATIONED/i)).toHaveCount(0);
  await expect(inv.getByText(/QUESTIONS ANSWERED/i)).toHaveCount(0);
  await expect(inv.getByText('CLINICAL SOURCES')).toBeVisible();
  await expect(inv.getByText('OFFLINE BUNDLED')).toBeVisible();
  await expect(inv.getByText(/RECOMMENDED DOSE FOR/i)).toHaveCount(0);
  await expect(inv.getByText(/CLINICAL DECISION BASIS/i)).toHaveCount(0);

  await page.getByRole('button', { name: /^Take 3 tablets$/i }).click();
  await expect(inv).toContainText('Taken & Deducted');
  await expect(inv).toContainText('DOSE TAKEN');
  await expect(inv).not.toContainText('DEPLETED');

  // Taking a suggested dose must NOT emit any crew alert or beep
  await expect(page.getByTestId('crew-alert-banner')).toHaveCount(0);
  const preEditBeeps = await page.evaluate(() => (window as { __mednavAlertCount?: number }).__mednavAlertCount ?? 0);
  expect(preEditBeeps).toBe(0);

  // Verify Medical Inventory: no "DAY 180", no per-med details in readiness panel, clean single-line summary
  await page.getByRole('button', { name: 'Medical Inventory', exact: true }).click();
  await expect(page.locator('.inv-med-inventory-row').first()).toBeVisible();
  await expect(page.getByText(/DAY\s*180/i)).toHaveCount(0);
  const readiness = page.locator('.inv-readiness-panel');
  await expect(readiness).toContainText('ONBOARD MEDICAL READINESS');
  await expect(readiness.locator('.telemetry-kv-row', { hasText: 'Medication Types:' })).toContainText('6 Types');
  await expect(readiness.locator('.telemetry-kv-row', { hasText: 'Hardware & Supplies:' })).toContainText('6 Types');
  await expect(readiness.locator('.telemetry-kv-row', { hasText: 'Acetaminophen 500 mg:' })).toHaveCount(0);
  await expect(page.getByText(/Fixed pre-flight medication pack/i)).toHaveCount(0);
  await expect(page.getByText('ISS FORMULARY ACTIVE')).toHaveCount(0);
  await expect(page.getByText('STOCK WATCH')).toHaveCount(0);
  await expect(page.getByText(/PRE-FLIGHT BASIS/i)).toHaveCount(0);
  await expect(page.getByText(/\d+\s*\/\s*\d+\s*USABLE/)).toHaveCount(0);
  await expect(page.getByText(/AUTO-DEDUCTED ON TAKE/i)).toHaveCount(0);

  const acetRow = page.locator('.inv-med-inventory-row', { hasText: 'Acetaminophen 500 mg' });
  await expect(acetRow).toContainText('21 tablets remaining');
  await expect(acetRow.getByRole('button', { name: '-1' })).toHaveCount(0);
  await expect(acetRow.getByRole('button', { name: '+1' })).toHaveCount(0);

  // Use Edit -> change to 19 -> Save -> verifies 2-beep crew alert appears AND auto-dismisses after ~1s
  await acetRow.getByRole('button', { name: 'Edit Acetaminophen 500 mg' }).click();
  await acetRow.getByLabel('Quantity for Acetaminophen 500 mg').fill('19');
  await acetRow.getByRole('button', { name: 'Save Acetaminophen 500 mg' }).click();

  await expect(page.getByTestId('crew-alert-banner')).toContainText('2× audio beep');
  await expect(acetRow).toContainText('19 tablets remaining');
  const beepCount = await page.evaluate(() => (window as { __mednavAlertCount?: number }).__mednavAlertCount ?? 0);
  expect(beepCount).toBe(2);
  await expect(page.getByTestId('crew-alert-banner')).toHaveCount(0, { timeout: 3000 });
});
