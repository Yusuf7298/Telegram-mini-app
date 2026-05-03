import { test, expect } from './playwright-fixtures';

// Utility to extract numeric balance from UI text
async function getBalance(page, selector = '[data-testid="wallet-balance"]') {
  const text = await page.locator(selector).innerText();
  return parseFloat(text.replace(/[^\d.-]/g, ''));
}

test.describe.serial('Production Smoke Test', () => {
  test('Login', async ({ page }) => {
    await page.goto('/login');
    // Simulate login (adapt selectors as needed)
    await page.getByLabel('Username').fill('smokeuser');
    await page.getByLabel('Password').fill('smokepass');
    await page.getByRole('button', { name: /login/i }).click();
    await expect(page).toHaveURL(/\/(dashboard|account|home)/, { timeout: 10000 });
    await expect(page.getByText(/welcome|account|dashboard/i)).toBeVisible();
  });

  test('Referral flow', async ({ page }) => {
    await page.goto('/referrals');
    await page.getByLabel('Referral code').fill('SMOKEREF');
    await page.getByRole('button', { name: /apply referral/i }).click();
    await expect(page.getByText(/referral code applied|success/i)).toBeVisible();
  });

  test('Open box', async ({ page }) => {
    await page.goto('/play');
    const before = await getBalance(page);
    await page.getByRole('button', { name: /open box/i }).click();
    await expect(page.getByText(/you won/i)).toBeVisible();
    const after = await getBalance(page);
    expect(after).toBeGreaterThanOrEqual(before); // No negative anomaly
  });

  test('Wallet update', async ({ page }) => {
    await page.goto('/account');
    await page.getByRole('button', { name: /update wallet/i }).click();
    await expect(page.getByText(/wallet updated|success/i)).toBeVisible();
  });

  test('Withdraw', async ({ page }) => {
    await page.goto('/wallet');
    const before = await getBalance(page);
    await page.getByRole('button', { name: /withdraw/i }).click();
    await expect(page.getByText(/withdrawal successful|success/i)).toBeVisible();
    const after = await getBalance(page);
    expect(after).toBeLessThanOrEqual(before); // No negative anomaly
  });
});
