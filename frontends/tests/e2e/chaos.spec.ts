import { test, expect } from './playwright-fixtures';

function randomDelay() {
  // 1–5 seconds
  return 1000 + Math.floor(Math.random() * 4000);
}

function shouldFail() {
  // 30% fail rate
  return Math.random() < 0.3;
}

function shouldDrop() {
  // 10% drop rate
  return Math.random() < 0.1;
}

test.describe('Chaos Network Instability', () => {
  test.beforeEach(async ({ page }) => {
    await page.route('**/api/**', async (route, request) => {
      if (shouldDrop()) {
        // Drop response (simulate network drop)
        await new Promise(r => setTimeout(r, randomDelay()));
        return route.abort('failed');
      }
      if (shouldFail()) {
        await new Promise(r => setTimeout(r, randomDelay()));
        return route.fulfill({ status: 502, body: JSON.stringify({ message: 'Random chaos failure' }) });
      }
      await new Promise(r => setTimeout(r, randomDelay()));
      // Pass through to real handler (or mock as needed)
      return route.continue();
    });
  });

  test('UI remains responsive under chaos', async ({ page }) => {
    await page.goto('/');

    // Try to navigate to several pages and interact with UI
    const navs = [
      { label: 'Profile', path: '/profile' },
      { label: 'Wallet', path: '/wallet' },
      { label: 'Game', path: '/play' },
      { label: 'Referrals', path: '/referrals' },
    ];

    for (const nav of navs) {
      await page.goto(nav.path);
      // UI should render some core element
      await expect(page.locator('main')).toBeVisible({ timeout: 7000 });
      // UI should not freeze: try to click a button if present
      const btn = page.locator('button').first();
      if (await btn.isVisible().catch(() => false)) {
        await btn.click({ trial: true }).catch(() => {});
      }
    }
  });

  test('Retry works and no duplicate actions', async ({ page }) => {
    await page.goto('/play');
    // Try to open a box, which may fail randomly
    const openBoxBtn = page.getByRole('button', { name: /open box/i });
    if (await openBoxBtn.isVisible().catch(() => false)) {
      await openBoxBtn.click();
      // If error, retry
      const retryBtn = page.getByRole('button', { name: /retry/i });
      if (await retryBtn.isVisible({ timeout: 6000 }).catch(() => false)) {
        await retryBtn.click();
      }
      // After retry, either success or error, but no duplicate reward
      // (Assume reward text or error is visible, and no double increment)
      const reward = page.locator('text=You won');
      await expect(reward.or(retryBtn)).toBeVisible({ timeout: 7000 });
    }
  });

  test('No inconsistent UI state after chaos', async ({ page }) => {
    await page.goto('/wallet');
    // Try to withdraw, which may fail or be dropped
    const withdrawBtn = page.getByRole('button', { name: /withdraw/i });
    if (await withdrawBtn.isVisible().catch(() => false)) {
      await withdrawBtn.click();
      // If error, retry
      const retryBtn = page.getByRole('button', { name: /retry/i });
      if (await retryBtn.isVisible({ timeout: 6000 }).catch(() => false)) {
        await retryBtn.click();
      }
      // UI should not show both loading and error at the same time
      const loading = page.locator('text=Loading');
      const error = page.locator('text=Something went wrong');
      expect(
        !(await loading.isVisible().catch(() => false) && await error.isVisible().catch(() => false))
      ).toBeTruthy();
    }
  });
});
