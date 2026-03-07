import { describe, test, expect, afterAll } from "vitest";
import { autoScroll } from "../src/scroll.js";
import { getBrowser, closeBrowser } from "../src/browser.js";
import path from "node:path";

const LAZY_PAGE = `file://${path.resolve("tests/fixtures/lazy-page.html")}`;

describe("auto-scroll", () => {
  afterAll(async () => {
    await closeBrowser();
  });

  test("autoScroll(page) scrolls to bottom then back to top (scrollY === 0 after)", async () => {
    const browser = await getBrowser();
    const context = await browser.newContext({ viewport: { width: 800, height: 600 } });
    const page = await context.newPage();
    await page.goto(LAZY_PAGE, { waitUntil: "load" });

    await autoScroll(page);

    const scrollY = await page.evaluate(() => window.scrollY);
    expect(scrollY).toBe(0);

    await context.close();
  });

  test("autoScroll on lazy-page.html triggers image loading (images have naturalWidth > 0)", async () => {
    const browser = await getBrowser();
    const context = await browser.newContext({ viewport: { width: 800, height: 600 } });
    const page = await context.newPage();
    await page.goto(LAZY_PAGE, { waitUntil: "load" });

    await autoScroll(page);

    const imageWidths = await page.evaluate(() => {
      const imgs = document.querySelectorAll("img[loading='lazy']");
      return Array.from(imgs).map((img) => (img as HTMLImageElement).naturalWidth);
    });
    expect(imageWidths.length).toBe(4);
    for (const w of imageWidths) {
      expect(w).toBeGreaterThan(0);
    }

    await context.close();
  });

  test("autoScroll completes within timeout (does not hang)", async () => {
    const browser = await getBrowser();
    const context = await browser.newContext({ viewport: { width: 800, height: 600 } });
    const page = await context.newPage();
    await page.goto(LAZY_PAGE, { waitUntil: "load" });

    const start = Date.now();
    await autoScroll(page);
    const elapsed = Date.now() - start;

    // Should complete well within 10 seconds
    expect(elapsed).toBeLessThan(10000);

    await context.close();
  });
});
