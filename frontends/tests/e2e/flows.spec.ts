import { test, expect } from './playwright-fixtures';
import { seedTelegramAndSession } from "./helpers/session";
import { startQaCapture } from "./helpers/capture";

test.describe("Minimal frontend E2E flows", () => {
  test("1) Auth login", async ({ page }, testInfo) => {
    await page.addInitScript(() => {
      (window as unknown as { Telegram?: unknown }).Telegram = {
        WebApp: {
          initData: "qa_init_data",
          initDataUnsafe: {
            user: {
              id: 123456,
              first_name: "QA",
              username: "qa_user",
            },
          },
        },
      };
    });

    await page.route("**/auth/telegram-login", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          success: true,
          data: {
            token: "qa_token",
            user: {
              id: "qa-user-1",
              role: "USER",
              telegramId: "123456",
              username: "qa_user",
              firstName: "QA",
              referralCode: "QA_REF",
              freeBoxUsed: false,
            },
          },
        }),
      });
    });

    await page.route("**/game/boxes", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ success: true, data: [] }),
      });
    });

    const finishCapture = await startQaCapture(page, testInfo);
    try {
      await page.goto("/login");
      await page.waitForURL("/", { timeout: 20_000 });

      const token = await page.evaluate(() => localStorage.getItem("boxplay_token"));
      expect(token).toBe("qa_token");
    } finally {
      await finishCapture("auth-login");
    }
  });

  test("2) Referral link usage (UI apply + JOINED state)", async ({ page }, testInfo) => {
    await seedTelegramAndSession(page, { withToken: true, referralCode: "MYCODE01" });

    let referralUseCalled = false;

    await page.route("**/referral/code", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ success: true, data: { referralCode: "MYCODE01" } }),
      });
    });

    await page.route("**/game/config", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          success: true,
          data: { referralRewardAmount: 200, maxReferralsPerIpPerDay: 10, waitlistBonus: 1000 },
        }),
      });
    });

    await page.route("**/referral/list", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          success: true,
          data: {
            referrals: [
              {
                referredUserId: "referred-1",
                user: "Referred One",
                createdAt: new Date().toISOString(),
                referralStatus: "JOINED",
                rewardAmount: 0,
              },
            ],
            totals: { activeReferrals: 0, totalEarned: 0 },
          },
        }),
      });
    });

    await page.route("**/referral/use", async (route) => {
      referralUseCalled = true;
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          success: true,
          data: {
            applied: true,
            walletSnapshot: { cashBalance: 100000, bonusBalance: 0, airtimeBalance: 0 },
          },
        }),
      });
    });

    const finishCapture = await startQaCapture(page, testInfo);
    try {
      await page.goto("/referrals");
      await page.getByLabel("Referral code").fill("INVITER123");
      await page.getByRole("button", { name: "Apply Referral" }).click();

      await expect(page.getByText("Referral code applied successfully")).toBeVisible();
      await expect(page.getByText("JOINED").first()).toBeVisible();
      expect(referralUseCalled).toBeTruthy();
    } finally {
      await finishCapture("referral-link-usage");
    }
  });

  test("3) Open box + 4) Wallet balance update + referral JOINED to ACTIVE", async ({ page }, testInfo) => {
    await seedTelegramAndSession(page, { withToken: true, referralCode: "MYCODE01" });

    let status: "JOINED" | "ACTIVE" = "JOINED";
    let playerCash = 100000;

    await page.route("**/game/boxes", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ success: true, data: [{ id: "box-1", name: "Base Box", price: 100 }] }),
      });
    });

    await page.route("**/api/wallet/transactions", async (route) => {
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ success: true, data: [] }) });
    });

    await page.route("**/api/wallet", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          success: true,
          data: { cashBalance: playerCash, bonusBalance: 0, airtimeBalance: 0 },
        }),
      });
    });

    await page.route("**/rewards/daily/status", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ success: true, data: { streak: 1, nextStreak: 2, nextRewardAmount: 50, canClaim: false } }),
      });
    });

    await page.route("**/rewards/win-history**", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ success: true, data: { timeline: [], bigWinThreshold: 1000 } }),
      });
    });

    await page.route("**/stats/top-winners**", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ success: true, data: { winners: [] } }),
      });
    });

    await page.route("**/referral/list", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          success: true,
          data: {
            referrals: [
              {
                referredUserId: "referred-1",
                user: "Referred One",
                createdAt: new Date().toISOString(),
                referralStatus: status,
                rewardAmount: status === "ACTIVE" ? 200 : 0,
              },
            ],
            totals: { activeReferrals: status === "ACTIVE" ? 1 : 0, totalEarned: status === "ACTIVE" ? 200 : 0 },
          },
        }),
      });
    });

    await page.route("**/api/game/open-box", async (route) => {
      playerCash = 100020;
      status = "ACTIVE";
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          success: true,
          data: {
            reward: 120,
            referralActivation: {
              referredUserId: "referred-1",
              referrerId: "inviter-1",
              rewardAmount: "200",
            },
            walletSnapshot: {
              cashBalance: playerCash,
              bonusBalance: 0,
              airtimeBalance: 0,
            },
          },
        }),
      });
    });

    const finishCapture = await startQaCapture(page, testInfo);
    try {
      await page.goto("/play");
      // Capture balance before
      const balanceTextBefore = await page.locator('[data-testid="wallet-balance"]').innerText().catch(() => null);
      await page.getByRole("button", { name: /Open Box -/ }).click();
      await expect(page.getByText("You won 120 coins")).toBeVisible();
      await expect(page.getByText("₦100,020").first()).toBeVisible();
      // Capture balance after
      const balanceTextAfter = await page.locator('[data-testid="wallet-balance"]').innerText().catch(() => null);
      // Assert correct delta
      if (balanceTextBefore && balanceTextAfter) {
        const before = parseFloat(balanceTextBefore.replace(/[^\d.-]/g, ''));
        const after = parseFloat(balanceTextAfter.replace(/[^\d.-]/g, ''));
        expect(after - before).toBe(20);
      }

      await page.goto("/referrals");
      await expect(page.getByText("ACTIVE").first()).toBeVisible();
      await expect(page.getByText("₦200").first()).toBeVisible();
    } finally {
      await finishCapture("open-box-wallet-referral-transition");
    }
  });

  test("5) Withdraw with error handling UI (fail then retry success)", async ({ page }, testInfo) => {
    await seedTelegramAndSession(page, { withToken: true });

    let walletCash = 100020;
    let withdrawAttempts = 0;

    await page.route("**/api/wallet", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          success: true,
          data: { cashBalance: walletCash, bonusBalance: 0, airtimeBalance: 0 },
        }),
      });
    });

    await page.route("**/api/wallet/transactions", async (route) => {
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ success: true, data: [] }) });
    });

    await page.route("**/wallet/withdraw", async (route) => {
      withdrawAttempts += 1;

      if (withdrawAttempts === 1) {
        await route.fulfill({
          status: 500,
          contentType: "application/json",
          body: JSON.stringify({
            success: false,
            error: { code: "INTERNAL_ERROR", message: "Withdraw failed" },
          }),
        });
        return;
      }

      walletCash -= 100;
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          success: true,
          data: {
            cashBalance: walletCash,
            bonusBalance: 0,
            airtimeBalance: 0,
          },
        }),
      });
    });

    const finishCapture = await startQaCapture(page, testInfo);
    try {
      await page.goto("/withdraw");
      // Capture balance before
      const balanceTextBefore = await page.locator('[data-testid="wallet-balance"]').innerText().catch(() => null);
      await page.getByLabel("Withdrawal amount").fill("100");
      await page.getByRole("button", { name: "WITHDRAW" }).click();

      await expect(page.getByText(/Something went wrong|Try again/).first()).toBeVisible();
      await expect(page.getByRole("button", { name: "Retry" })).toBeVisible();

      await page.getByRole("button", { name: "Retry" }).click();
      await expect(page.getByText("Withdrawal successful")).toBeVisible();

      await page.goto("/wallet");
      // Capture balance after
      const balanceTextAfter = await page.locator('[data-testid="wallet-balance"]').innerText().catch(() => null);
      // Assert correct delta
      if (balanceTextBefore && balanceTextAfter) {
        const before = parseFloat(balanceTextBefore.replace(/[^\d.-]/g, ''));
        const after = parseFloat(balanceTextAfter.replace(/[^\d.-]/g, ''));
        expect(before - after).toBe(100);
      }
    } finally {
      await finishCapture("withdraw-error-and-retry");
    }
  });
});
