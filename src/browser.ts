import { chromium, type Browser } from "playwright";

let browser: Browser | null = null;

/**
 * Get or launch a singleton Chromium browser instance.
 * If the browser was closed or disconnected, a new one is launched.
 */
export async function getBrowser(): Promise<Browser> {
  if (browser && browser.isConnected()) {
    return browser;
  }
  browser = await chromium.launch({ headless: true });
  return browser;
}

/**
 * Close the browser if connected and reset the singleton.
 */
export async function closeBrowser(): Promise<void> {
  if (browser) {
    try {
      if (browser.isConnected()) {
        await browser.close();
      }
    } catch {
      // Browser may already be closed
    }
    browser = null;
  }
}

/**
 * Register process signal handlers for graceful browser shutdown.
 * Attaches SIGINT, SIGTERM, and uncaughtException handlers.
 */
export function registerCleanup(): void {
  const cleanup = async () => {
    await closeBrowser();
    process.exit(0);
  };

  process.on("SIGINT", cleanup);
  process.on("SIGTERM", cleanup);
  process.on("uncaughtException", async (err) => {
    process.stderr.write(`Uncaught exception: ${err.message}\n`);
    await closeBrowser();
    process.exit(1);
  });
}
