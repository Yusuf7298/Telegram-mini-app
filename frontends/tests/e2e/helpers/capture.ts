import { Page, TestInfo } from "@playwright/test";

type ConsoleError = {
  type: string;
  text: string;
  location?: { url?: string; lineNumber?: number; columnNumber?: number };
};

type ApiRecord = {
  url: string;
  status: number;
  method: string;
  body?: unknown;
};

function isApiUrl(url: string): boolean {
  return (
    url.includes("/api/") ||
    url.includes("/wallet/") ||
    url.includes("/game/") ||
    url.includes("/auth/") ||
    url.includes("/referral/")
  );
}

export async function startQaCapture(page: Page, testInfo: TestInfo) {
  const consoleErrors: ConsoleError[] = [];
  const pageErrors: string[] = [];
  const apiResponses: ApiRecord[] = [];

  const onConsole = (msg: Parameters<Page["on"]>[1] extends (...args: infer A) => unknown ? A[0] : never) => {
    if (msg.type() === "error") {
      consoleErrors.push({
        type: msg.type(),
        text: msg.text(),
        location: msg.location(),
      });
    }
  };

  const onPageError = (error: Error) => {
    pageErrors.push(error.message);
  };

  const onResponse = async (response: Awaited<ReturnType<Page["waitForResponse"]>>) => {
    const url = response.url();
    if (!isApiUrl(url)) {
      return;
    }

    const request = response.request();
    const entry: ApiRecord = {
      url,
      status: response.status(),
      method: request.method(),
    };

    const contentType = response.headers()["content-type"] ?? "";
    if (contentType.includes("application/json")) {
      try {
        entry.body = await response.json();
      } catch {
        entry.body = "<unparseable-json>";
      }
    }

    apiResponses.push(entry);
  };

  page.on("console", onConsole);
  page.on("pageerror", onPageError);
  page.on("response", onResponse);

  return async (label: string) => {
    page.off("console", onConsole);
    page.off("pageerror", onPageError);
    page.off("response", onResponse);

    const dom = page.isClosed() ? "<html><body>page-closed</body></html>" : await page.content();

    await testInfo.attach(`${label}-dom.html`, {
      body: Buffer.from(dom, "utf-8"),
      contentType: "text/html",
    });

    await testInfo.attach(`${label}-api-responses.json`, {
      body: Buffer.from(JSON.stringify(apiResponses, null, 2), "utf-8"),
      contentType: "application/json",
    });

    await testInfo.attach(`${label}-console-errors.json`, {
      body: Buffer.from(JSON.stringify({ consoleErrors, pageErrors }, null, 2), "utf-8"),
      contentType: "application/json",
    });
  };
}
