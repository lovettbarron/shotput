import fs from "node:fs/promises";
import path from "node:path";
import type { Page } from "playwright";
import { getBrowser } from "./browser.js";
import { autoScroll } from "./scroll.js";
import { resolveOutputPath, ensureOutputDir } from "./output.js";
import type { CaptureParams, CaptureResult, WaitStrategy } from "./types.js";

/**
 * Core capture pipeline: navigates to URL, optionally scrolls,
 * takes screenshot, saves to disk, returns result.
 */
export async function captureScreenshot(params: CaptureParams): Promise<CaptureResult> {
  const {
    url,
    fullPage,
    format,
    quality,
    width,
    height,
    scale,
    outputDir,
    filename,
    wait,
    autoScroll: shouldScroll,
    timeout,
  } = params;

  const browser = await getBrowser();
  const context = await browser.newContext({
    viewport: { width, height },
    deviceScaleFactor: scale,
  });

  let warning: string | undefined;

  try {
    const page = await context.newPage();

    // Navigate with appropriate wait strategy
    await navigatePage(page, url, wait, timeout).catch((err) => {
      if (isTimeoutError(err)) {
        warning = `Page load timed out after ${timeout}ms, capturing current state`;
      } else {
        throw err;
      }
    });

    // Auto-scroll to trigger lazy content if requested
    if (fullPage && shouldScroll) {
      await autoScroll(page);
    }

    // Take screenshot
    const buffer = Buffer.from(
      await page.screenshot({
        fullPage,
        type: format,
        quality: format === "jpeg" ? quality : undefined,
      })
    );

    // Resolve and ensure output path
    const filePath = resolveOutputPath(outputDir, filename, url, format);
    await ensureOutputDir(path.dirname(filePath));
    await fs.writeFile(filePath, buffer);

    return {
      filePath,
      buffer,
      format,
      width,
      height,
      warning,
    };
  } finally {
    await context.close();
  }
}

async function navigatePage(
  page: Page,
  url: string,
  wait: WaitStrategy | number,
  timeout: number
): Promise<void> {
  if (typeof wait === "number") {
    await page.goto(url, { waitUntil: "load", timeout });
    await page.waitForTimeout(wait);
  } else {
    await page.goto(url, { waitUntil: wait, timeout });
  }
}

function isTimeoutError(err: unknown): boolean {
  if (err instanceof Error) {
    return err.message.includes("Timeout") || err.name === "TimeoutError";
  }
  return false;
}
