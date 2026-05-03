import { Page } from "@playwright/test";

type SessionOptions = {
  withToken?: boolean;
  referralCode?: string;
};

export async function seedTelegramAndSession(page: Page, options: SessionOptions = {}) {
  const withToken = options.withToken ?? true;
  const referralCode = options.referralCode ?? "QA_REF";

  await page.addInitScript(
    ({ hasToken, code }) => {
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

      if (hasToken) {
        localStorage.setItem("boxplay_token", "qa_token");
        localStorage.setItem(
          "boxplay_user",
          JSON.stringify({
            id: "qa-user-1",
            role: "USER",
            telegramId: "123456",
            username: "qa_user",
            firstName: "QA",
            lastName: "User",
            referralCode: code,
            freeBoxUsed: false,
          })
        );
      }
    },
    { hasToken: withToken, code: referralCode }
  );
}
