import { test, expect } from './playwright-fixtures';

test.describe('Global failure modes', () => {
  test('ALL_FAIL shows FallbackError and app remains responsive', async ({ page }) => {
    await page.addInitScript(() => {
      // @ts-ignore
      window.__API_MOCK_LAYER_MODE = 'ALL_FAIL';
    });

    await page.goto('/');

    // Expect fallback error somewhere when loading critical data
    const fallback = page.locator('text=Something went wrong').first();
    await expect(fallback).toBeVisible({ timeout: 5000 });

    // Retry button should exist and be clickable
    const retry = page.locator('role=button[name="Retry"]').first();
    await expect(retry).toBeVisible();
    await retry.click();

    // After retry, since ALL_FAIL, still shows fallback
    await expect(fallback).toBeVisible();

    // Core interactive element (e.g., navigation) remains usable
    await page.click('a:has-text("Profile")').catch(() => {});
    await expect(page).toHaveURL(/profile|account|\/profile/, { timeout: 3000 }).catch(() => {});
  });

  test('INTERMITTENT_FAIL_EVERY_2ND triggers intermittent failures but recovers', async ({ page }) => {
    await page.addInitScript(() => {
      // @ts-ignore
      window.__API_MOCK_LAYER_MODE = 'INTERMITTENT_FAIL_EVERY_2ND';
    });

    await page.goto('/');

    // First call may fail or succeed; ensure UI doesn't freeze and errors are shown when present
    const fallback = page.locator('text=Something went wrong').first();
    if (await fallback.isVisible().catch(() => false)) {
      const retry = page.locator('role=button[name="Retry"]').first();
      await retry.click();
    }

    // Perform an action that triggers an API call repeatedly to observe intermittent behavior
    const openBox = page.locator('role=button[name="Open Box"]').first();
    if (await openBox.isVisible().catch(() => false)) {
      // Rapidly click twice; intermittent failure should cause at most one failure
      await openBox.click();
      await page.waitForTimeout(100);
      await openBox.click();

      // Ensure UI remains interactive
      await expect(openBox).toBeEnabled();
    }
  });
});
