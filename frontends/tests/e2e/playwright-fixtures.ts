import { test as base, expect as baseExpect, Page } from '@playwright/test';

type FixtureState = {
  consoleErrors: string[];
  requests: string[];
};

export const test = base.extend<FixtureState>({
  consoleErrors: async ({}, use, testInfo) => {
    const arr: string[] = [];
    await use(arr);
  },

  requests: async ({}, use) => {
    const arr: string[] = [];
    await use(arr);
  },

  // Attach listeners to the page for each test
  page: async ({ page }, use, testInfo) => {
    const consoleErrors: string[] = [];
    const requests: string[] = [];

    const onConsole = (msg: any) => {
      try {
        if (msg.type && msg.type() === 'error') {
          const text = msg.text ? msg.text() : String(msg);
          consoleErrors.push(text);
        }
      } catch (e) {
        // ignore
      }
    };

    const onRequest = (req: any) => {
      try {
        requests.push(req.url());
      } catch (e) {}
    };

    page.on('console', onConsole);
    page.on('request', onRequest);

    await use(page as Page & { __consoleErrors?: string[]; __requests?: string[] });

    // After test: detach listeners and attach arrays to page for afterEach assertions
    page.off('console', onConsole);
    page.off('request', onRequest);

    // Expose arrays on page object for optional debugging
    (page as any).__consoleErrors = consoleErrors;
    (page as any).__requests = requests;

    // Fail test if console errors detected
    if (consoleErrors.length > 0) {
      const msg = `Console errors detected:\n${consoleErrors.join('\n')}`;
      throw new Error(msg);
    }

    // Detect duplicate API calls to same endpoint within the test
    const urlCounts = new Map<string, number>();
    for (const u of requests) {
      try {
        const p = new URL(u);
        const key = p.pathname + (p.search || '');
        urlCounts.set(key, (urlCounts.get(key) || 0) + 1);
      } catch (e) {
        urlCounts.set(u, (urlCounts.get(u) || 0) + 1);
      }
    }
    const duplicates = Array.from(urlCounts.entries()).filter(([k, c]) => c > 1);
    if (duplicates.length > 0) {
      const lines = duplicates.map(([k, c]) => `${k} called ${c} times`);
      throw new Error(`Duplicate API calls detected:\n${lines.join('\n')}`);
    }
  },
});

export const expect = baseExpect;
export { Page };
