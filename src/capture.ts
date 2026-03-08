import fs from "node:fs/promises";
import path from "node:path";
import type { Page } from "playwright";
import { getBrowser } from "./browser.js";
import { autoScroll } from "./scroll.js";
import { resolveOutputPath, ensureOutputDir } from "./output.js";
import { getSessionManager } from "./auth.js";
import type { CaptureParams, CaptureResult, WaitStrategy } from "./types.js";

/**
 * Prepare the page before capture: hide elements, inject CSS, execute JS.
 * Order is deterministic: (1) hide elements, (2) inject CSS, (3) execute JS.
 */
async function preparePage(page: Page, params: CaptureParams): Promise<void> {
  if (params.hideSelectors?.length) {
    const css = params.hideSelectors
      .map((sel) => `${sel} { display: none !important; }`)
      .join("\n");
    await page.addStyleTag({ content: css });
  }
  if (params.injectCSS) {
    await page.addStyleTag({ content: params.injectCSS });
  }
  if (params.injectJS) {
    await page.evaluate(params.injectJS);
  }
}

/**
 * Core capture pipeline: navigates to URL, optionally scrolls,
 * takes screenshot, saves to disk, returns result.
 */
export async function captureScreenshot(params: CaptureParams): Promise<CaptureResult> {
  const {
    url,
    fullPage,
    format: requestedFormat,
    quality,
    width,
    height,
    scale,
    outputDir,
    filename,
    wait,
    autoScroll: shouldScroll,
    timeout,
    selector,
    padding = 0,
    omitBackground = false,
  } = params;

  const browser = await getBrowser();

  // Resolve session storage state if sessionName provided
  let storageState: import("./types.js").StorageState | undefined;
  let warning: string | undefined;

  if (params.sessionName) {
    const session = getSessionManager().getSession(params.sessionName);
    if (session) {
      storageState = session;
    } else {
      warning = `Session '${params.sessionName}' not found, capturing without authentication`;
    }
  }

  const context = await browser.newContext({
    viewport: { width, height },
    deviceScaleFactor: scale,
    ...(storageState ? { storageState } : {}),
  });
  let format = requestedFormat;

  // Handle JPEG + omitBackground incompatibility
  if (omitBackground && format === "jpeg") {
    warning = "omitBackground requires PNG format; switching from JPEG to PNG";
    format = "png";
  }

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

    // Auto-scroll to trigger lazy content if requested (only for non-element captures)
    if (!selector && fullPage && shouldScroll) {
      await autoScroll(page);
    }

    // Run page preparation pipeline
    await preparePage(page, params);

    let buffer: Buffer;
    let resultWidth = width;
    let resultHeight = height;

    if (selector) {
      // Element capture
      const locator = page.locator(selector);
      try {
        await locator.waitFor({ state: "visible", timeout: 5000 });
      } catch {
        throw new Error(`Element not found or not visible: ${selector}`);
      }

      if (padding === 0) {
        buffer = Buffer.from(
          await locator.screenshot({
            type: format,
            quality: format === "jpeg" ? quality : undefined,
            omitBackground,
          })
        );
        const box = await locator.boundingBox();
        if (box) {
          resultWidth = Math.round(box.width);
          resultHeight = Math.round(box.height);
        }
      } else {
        // With padding: use bounding box + clip
        const box = await locator.boundingBox();
        if (!box) {
          throw new Error(`Element not visible: ${selector}`);
        }
        const clip = {
          x: Math.max(0, box.x - padding),
          y: Math.max(0, box.y - padding),
          width: box.width + padding * 2,
          height: box.height + padding * 2,
        };
        buffer = Buffer.from(
          await page.screenshot({
            type: format,
            quality: format === "jpeg" ? quality : undefined,
            omitBackground,
            clip,
          })
        );
        resultWidth = Math.round(clip.width);
        resultHeight = Math.round(clip.height);
      }
    } else {
      // Full page / viewport capture (existing behavior)
      buffer = Buffer.from(
        await page.screenshot({
          fullPage,
          type: format,
          quality: format === "jpeg" ? quality : undefined,
        })
      );
    }

    // Resolve and ensure output path
    const filePath = resolveOutputPath(outputDir, filename, url, format);
    await ensureOutputDir(path.dirname(filePath));
    await fs.writeFile(filePath, buffer);

    return {
      filePath,
      buffer,
      format,
      width: resultWidth,
      height: resultHeight,
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
