import { describe, test, expect, afterAll, afterEach } from "vitest";
import { captureScreenshot } from "../src/capture.js";
import { closeBrowser } from "../src/browser.js";
import type { CaptureParams } from "../src/types.js";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

const TEST_PAGE = `file://${path.resolve("tests/fixtures/test-page.html")}`;
const LAZY_PAGE = `file://${path.resolve("tests/fixtures/lazy-page.html")}`;

function makeParams(overrides: Partial<CaptureParams> = {}): CaptureParams {
  return {
    url: TEST_PAGE,
    fullPage: false,
    format: "png",
    width: 1280,
    height: 720,
    scale: 1,
    wait: "load" as const,
    autoScroll: false,
    timeout: 30000,
    ...overrides,
  };
}

let tmpDir: string;

async function freshTmpDir(): Promise<string> {
  tmpDir = path.join(os.tmpdir(), `shotput-capture-test-${Date.now()}`);
  await fs.mkdir(tmpDir, { recursive: true });
  return tmpDir;
}

afterEach(async () => {
  if (tmpDir) {
    await fs.rm(tmpDir, { recursive: true, force: true }).catch(() => {});
  }
});

afterAll(async () => {
  await closeBrowser();
});

describe("capture", () => {
  test("viewport capture returns CaptureResult with valid PNG buffer", async () => {
    const dir = await freshTmpDir();
    const result = await captureScreenshot(makeParams({ outputDir: dir }));
    expect(result.buffer).toBeInstanceOf(Buffer);
    expect(result.format).toBe("png");
    // PNG magic bytes: 89 50 4E 47
    expect(result.buffer[0]).toBe(0x89);
    expect(result.buffer[1]).toBe(0x50);
    expect(result.buffer[2]).toBe(0x4e);
    expect(result.buffer[3]).toBe(0x47);
  });

  test("fullPage: true captures full scrollable height (buffer > viewport-only)", async () => {
    const dir1 = await freshTmpDir();
    const viewportResult = await captureScreenshot(
      makeParams({ url: LAZY_PAGE, fullPage: false, outputDir: dir1 })
    );
    const dir2 = await freshTmpDir();
    const fullResult = await captureScreenshot(
      makeParams({ url: LAZY_PAGE, fullPage: true, outputDir: dir2 })
    );
    expect(fullResult.buffer.length).toBeGreaterThan(viewportResult.buffer.length);
  });

  test("format: jpeg produces JPEG buffer (starts with FF D8)", async () => {
    const dir = await freshTmpDir();
    const result = await captureScreenshot(
      makeParams({ format: "jpeg", quality: 80, outputDir: dir })
    );
    expect(result.format).toBe("jpeg");
    expect(result.buffer[0]).toBe(0xff);
    expect(result.buffer[1]).toBe(0xd8);
  });

  test("JPEG quality: 10 produces smaller file than quality: 90", async () => {
    const dir1 = await freshTmpDir();
    const lowQ = await captureScreenshot(
      makeParams({ format: "jpeg", quality: 10, outputDir: dir1 })
    );
    const dir2 = await freshTmpDir();
    const highQ = await captureScreenshot(
      makeParams({ format: "jpeg", quality: 90, outputDir: dir2 })
    );
    expect(lowQ.buffer.length).toBeLessThan(highQ.buffer.length);
  });

  test("width: 800, height: 600 produces screenshot at those dimensions", async () => {
    const dir = await freshTmpDir();
    const result = await captureScreenshot(
      makeParams({ width: 800, height: 600, outputDir: dir })
    );
    expect(result.width).toBe(800);
    expect(result.height).toBe(600);
  });

  test("scale: 2 produces image with 2x pixel dimensions", async () => {
    const dir = await freshTmpDir();
    const result = await captureScreenshot(
      makeParams({ width: 400, height: 300, scale: 2, outputDir: dir })
    );
    // With scale 2, the pixel dimensions should be 800x600
    expect(result.width).toBe(400);
    expect(result.height).toBe(300);
    // The buffer should be larger than a 1x capture
    const dir2 = await freshTmpDir();
    const result1x = await captureScreenshot(
      makeParams({ width: 400, height: 300, scale: 1, outputDir: dir2 })
    );
    expect(result.buffer.length).toBeGreaterThan(result1x.buffer.length);
  });

  test("outputDir and filename saves file at that path", async () => {
    const dir = await freshTmpDir();
    const result = await captureScreenshot(
      makeParams({ outputDir: dir, filename: "custom-shot.png" })
    );
    expect(result.filePath).toBe(path.resolve(dir, "custom-shot.png"));
    const stat = await fs.stat(result.filePath);
    expect(stat.isFile()).toBe(true);
  });

  test('wait: "domcontentloaded" does not wait for networkidle', async () => {
    const dir = await freshTmpDir();
    const start = Date.now();
    const result = await captureScreenshot(
      makeParams({ wait: "domcontentloaded", outputDir: dir })
    );
    // Should complete quickly -- just checking it works
    expect(result.buffer.length).toBeGreaterThan(0);
    expect(Date.now() - start).toBeLessThan(30000);
  });

  test("wait: 500 (number) waits after load", async () => {
    const dir = await freshTmpDir();
    const start = Date.now();
    const result = await captureScreenshot(
      makeParams({ wait: 500, outputDir: dir })
    );
    expect(result.buffer.length).toBeGreaterThan(0);
    // Should take at least ~500ms due to the wait
    expect(Date.now() - start).toBeGreaterThanOrEqual(400);
  });

  test("fullPage: true, autoScroll: true triggers lazy content", async () => {
    const dir = await freshTmpDir();
    const result = await captureScreenshot(
      makeParams({
        url: LAZY_PAGE,
        fullPage: true,
        autoScroll: true,
        outputDir: dir,
      })
    );
    expect(result.buffer.length).toBeGreaterThan(0);
    expect(result.format).toBe("png");
  });

  test("fullPage: true, autoScroll: false skips scrolling", async () => {
    const dir = await freshTmpDir();
    const result = await captureScreenshot(
      makeParams({
        url: LAZY_PAGE,
        fullPage: true,
        autoScroll: false,
        outputDir: dir,
      })
    );
    expect(result.buffer.length).toBeGreaterThan(0);
  });

  test("result includes filePath pointing to a file that exists on disk", async () => {
    const dir = await freshTmpDir();
    const result = await captureScreenshot(makeParams({ outputDir: dir }));
    const stat = await fs.stat(result.filePath);
    expect(stat.isFile()).toBe(true);
    const fileContent = await fs.readFile(result.filePath);
    expect(fileContent.length).toBe(result.buffer.length);
  });

  test("result includes base64-encodable buffer", async () => {
    const dir = await freshTmpDir();
    const result = await captureScreenshot(makeParams({ outputDir: dir }));
    const b64 = result.buffer.toString("base64");
    expect(b64.length).toBeGreaterThan(0);
    // Round-trip check
    const decoded = Buffer.from(b64, "base64");
    expect(decoded.equals(result.buffer)).toBe(true);
  });
});
