import { describe, test, expect, afterEach } from "vitest";
import { getBrowser, closeBrowser, registerCleanup } from "../src/browser.js";

describe("browser lifecycle", () => {
  afterEach(async () => {
    await closeBrowser();
  });

  test("getBrowser() returns a connected Browser instance", async () => {
    const browser = await getBrowser();
    expect(browser).toBeDefined();
    expect(browser.isConnected()).toBe(true);
  });

  test("getBrowser() called twice returns the same instance (singleton)", async () => {
    const browser1 = await getBrowser();
    const browser2 = await getBrowser();
    expect(browser1).toBe(browser2);
  });

  test("closeBrowser() disconnects the browser", async () => {
    const browser = await getBrowser();
    expect(browser.isConnected()).toBe(true);
    await closeBrowser();
    expect(browser.isConnected()).toBe(false);
  });

  test("after closeBrowser(), next getBrowser() launches a new browser", async () => {
    const browser1 = await getBrowser();
    await closeBrowser();
    const browser2 = await getBrowser();
    expect(browser2).not.toBe(browser1);
    expect(browser2.isConnected()).toBe(true);
  });

  test("registerCleanup() registers SIGINT/SIGTERM handlers", () => {
    const originalListenerCount = process.listenerCount("SIGINT");
    registerCleanup();
    expect(process.listenerCount("SIGINT")).toBeGreaterThan(originalListenerCount);
    expect(process.listenerCount("SIGTERM")).toBeGreaterThan(0);
    // Clean up listeners we added
    process.removeAllListeners("SIGINT");
    process.removeAllListeners("SIGTERM");
  });
});
