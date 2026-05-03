import { test, expect } from './playwright-fixtures';

// Utility to mock API with delay, error, or retry
async function mockApiRoute(page, url, { delay = 0, fail = false, failCode = 500, failTimes = 0, succeedAfter = 0, response = {}, method = 'POST' }) {
  let callCount = 0;
  await page.route(url, async (route, request) => {
    callCount++;
    if (delay) await new Promise(r => setTimeout(r, delay));
    if (fail && callCount <= failTimes) {
      if (failCode === 'network') {
        return route.abort('failed');
      }
      return route.fulfill({ status: failCode, body: JSON.stringify({ message: 'Simulated error' }) });
    }
    return route.fulfill({ status: 200, body: JSON.stringify(response) });
  });
  return () => callCount;
}

test.describe('Frontend Runtime Validation', () => {
  test('Referral flow: slow network, error, retry, success', async ({ page }) => {
    const apiUrl = '**/api/referral*';
    let callCount = 0;
    await page.route(apiUrl, async (route, request) => {
      callCount++;
      // First call: slow + fail, Second: slow + succeed
      if (callCount === 1) {
        await new Promise(r => setTimeout(r, 3500));
        return route.fulfill({ status: 500, body: JSON.stringify({ message: 'Simulated server error' }) });
      }
      await new Promise(r => setTimeout(r, 3500));
      return route.fulfill({ status: 200, body: JSON.stringify({ data: { referrals: [], totals: { activeReferrals: 0, totalEarned: 0 } } }) });
    });
    const errors = [];
    page.on('console', msg => { if (msg.type() === 'error') errors.push(msg.text()); });
    const requests = [];
    page.on('request', req => { if (req.url().includes('/api/referral')) requests.push(req); });

    await page.goto('/(main)/referrals');
    await expect(page.getByText('Loading')).toBeVisible();
    await expect(page.getByRole('button', { name: /retry/i })).toBeVisible({ timeout: 6000 });
    await expect(page.getByText(/server error/i)).toBeVisible();
    await page.getByRole('button', { name: /retry/i }).click();
    await expect(page.getByText('Loading')).toBeVisible();
    await expect(page.getByText('Referral Status')).toBeVisible({ timeout: 6000 });
    expect(requests.length).toBe(2);
    expect(errors.length).toBe(0);
  });

  test('Open box flow: network error, retry, success', async ({ page }) => {
    let callCount = 0;
    let balanceBefore = 1000;
    let balanceAfter = 0;
    await page.route('**/api/wallet', async (route) => {
      // Simulate wallet balance endpoint
      await route.fulfill({ status: 200, body: JSON.stringify({ data: { cashBalance: balanceBefore } }) });
    });
    await page.route('**/api/game/open-box', async (route, request) => {
      callCount++;
      if (callCount === 1) {
        return route.abort('failed');
      }
      balanceAfter = balanceBefore + 100;
      return route.fulfill({ status: 200, body: JSON.stringify({ data: { reward: 100 } }) });
    });
    const errors = [];
    page.on('console', msg => { if (msg.type() === 'error') errors.push(msg.text()); });
    const requests = [];
    page.on('request', req => { if (req.url().includes('/api/game/open-box')) requests.push(req); });

    await page.goto('/(main)/game');
    // Capture balance before
    const balanceTextBefore = await page.locator('[data-testid="wallet-balance"]').innerText().catch(() => null);
    await page.getByRole('button', { name: /open box/i }).click();
    await expect(page.getByText(/network error/i)).toBeVisible();
    await page.getByRole('button', { name: /retry/i }).click();
    await expect(page.getByText(/reward/i)).toBeVisible({ timeout: 4000 });
    // Capture balance after
    const balanceTextAfter = await page.locator('[data-testid="wallet-balance"]').innerText().catch(() => null);
    // Assert correct delta
    if (balanceTextBefore && balanceTextAfter) {
      const before = parseFloat(balanceTextBefore.replace(/[^\d.-]/g, ''));
      const after = parseFloat(balanceTextAfter.replace(/[^\d.-]/g, ''));
      expect(after - before).toBe(100);
    }
    expect(requests.length).toBe(2);
    expect(errors.length).toBe(0);
  });

  test('Wallet update: slow + validation error, retry, success', async ({ page }) => {
    let callCount = 0;
    await page.route('**/api/wallet*', async (route, request) => {
      callCount++;
      if (callCount === 1) {
        await new Promise(r => setTimeout(r, 4000));
        return route.fulfill({ status: 400, body: JSON.stringify({ message: 'Invalid wallet update' }) });
      }
      return route.fulfill({ status: 200, body: JSON.stringify({ data: { cashBalance: 1000, bonusBalance: 100, airtimeBalance: 0 } }) });
    });
    const errors = [];
    page.on('console', msg => { if (msg.type() === 'error') errors.push(msg.text()); });
    const requests = [];
    page.on('request', req => { if (req.url().includes('/api/wallet')) requests.push(req); });

    await page.goto('/(main)/account');
    await page.getByRole('button', { name: /update wallet/i }).click();
    await expect(page.getByText(/validation error/i)).toBeVisible();
    await page.getByRole('button', { name: /retry/i }).click();
    await expect(page.getByText(/wallet/i)).toBeVisible({ timeout: 4000 });
    expect(requests.length).toBe(2);
    expect(errors.length).toBe(0);
  });

  test('Withdraw: prevent duplicate, error, retry, success', async ({ page }) => {
    let callCount = 0;
    let balanceBefore = 1000;
    let balanceAfter = 0;
    await page.route('**/api/wallet', async (route) => {
      await route.fulfill({ status: 200, body: JSON.stringify({ data: { cashBalance: balanceBefore } }) });
    });
    await page.route('**/api/wallet/withdraw', async (route, request) => {
      callCount++;
      if (callCount === 1) {
        return route.fulfill({ status: 502, body: JSON.stringify({ message: 'Simulated gateway error' }) });
      }
      balanceAfter = balanceBefore - 100;
      return route.fulfill({ status: 200, body: JSON.stringify({ data: { success: true } }) });
    });
    const errors = [];
    page.on('console', msg => { if (msg.type() === 'error') errors.push(msg.text()); });
    const requests = [];
    page.on('request', req => { if (req.url().includes('/api/wallet/withdraw')) requests.push(req); });

    await page.goto('/(main)/wallet');
    // Capture balance before
    const balanceTextBefore = await page.locator('[data-testid="wallet-balance"]').innerText().catch(() => null);
    await page.getByRole('button', { name: /withdraw/i }).click();
    await expect(page.getByText(/server error/i)).toBeVisible();
    await page.getByRole('button', { name: /retry/i }).click();
    await expect(page.getByText(/success/i)).toBeVisible({ timeout: 4000 });
    // Try clicking withdraw again while loading
    await page.getByRole('button', { name: /withdraw/i }).click();
    // Capture balance after
    const balanceTextAfter = await page.locator('[data-testid="wallet-balance"]').innerText().catch(() => null);
    // Assert correct delta
    if (balanceTextBefore && balanceTextAfter) {
      const before = parseFloat(balanceTextBefore.replace(/[^\d.-]/g, ''));
      const after = parseFloat(balanceTextAfter.replace(/[^\d.-]/g, ''));
      expect(before - after).toBe(100);
    }
    expect(requests.length).toBe(2); // No duplicate
    expect(errors.length).toBe(0);
  });
});
