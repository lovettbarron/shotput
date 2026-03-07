import type { Page } from "playwright";

const SCROLL_STEP = 250;
const SCROLL_DELAY = 100;
const MAX_SCROLL_TIME = 10_000;

/**
 * Auto-scroll the page to trigger lazy-loaded content.
 * Scrolls incrementally to the bottom, then back to top.
 * Waits for network idle after scrolling (with a catch for timeout).
 */
export async function autoScroll(page: Page): Promise<void> {
  await page.evaluate(
    async ({ step, delay, maxTime }) => {
      await new Promise<void>((resolve) => {
        const start = Date.now();
        let totalHeight = 0;

        const timer = setInterval(() => {
          const scrollHeight = document.body.scrollHeight;

          if (Date.now() - start > maxTime || totalHeight >= scrollHeight) {
            clearInterval(timer);
            window.scrollTo(0, 0);
            resolve();
            return;
          }

          window.scrollBy(0, step);
          totalHeight += step;
        }, delay);
      });
    },
    { step: SCROLL_STEP, delay: SCROLL_DELAY, maxTime: MAX_SCROLL_TIME }
  );

  // Wait for any lazy-loaded content triggered by scrolling
  try {
    await page.waitForLoadState("networkidle", { timeout: 5000 });
  } catch {
    // Timeout is acceptable -- we did our best to trigger lazy content
  }
}
