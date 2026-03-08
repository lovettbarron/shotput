import { describe, test, expect, beforeEach, vi } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { getSessionManager } from "../src/auth.js";
import type { StorageState } from "../src/types.js";

describe("SessionManager", () => {
  beforeEach(() => {
    getSessionManager().clearAllSessions();
  });

  test("cookie injection: createSessionFromCookies stores a valid StorageState", () => {
    const mgr = getSessionManager();
    const state = mgr.createSessionFromCookies("test", [
      { name: "sid", value: "abc", domain: "example.com" },
    ]);

    expect(state).toBeDefined();
    expect(state.cookies).toHaveLength(1);
    expect(state.cookies[0].name).toBe("sid");
    expect(state.cookies[0].value).toBe("abc");
    expect(state.cookies[0].domain).toBe("example.com");
    expect(state.origins).toEqual([]);
  });

  test("session retrieval: getSession returns stored StorageState", () => {
    const mgr = getSessionManager();
    mgr.createSessionFromCookies("mysite", [
      { name: "token", value: "xyz", domain: "mysite.com" },
    ]);

    const retrieved = mgr.getSession("mysite");
    expect(retrieved).toBeDefined();
    expect(retrieved!.cookies[0].name).toBe("token");
    expect(retrieved!.cookies[0].value).toBe("xyz");
  });

  test("session persistence: getSession returns same object each time", () => {
    const mgr = getSessionManager();
    mgr.createSessionFromCookies("s1", [
      { name: "a", value: "b", domain: "d.com" },
    ]);

    const first = mgr.getSession("s1");
    const second = mgr.getSession("s1");
    const third = mgr.getSession("s1");

    expect(first).toBe(second);
    expect(second).toBe(third);
  });

  test("unknown session: getSession returns undefined", () => {
    const mgr = getSessionManager();
    expect(mgr.getSession("nonexistent")).toBeUndefined();
  });

  test("clear session: clearSession removes specific session", () => {
    const mgr = getSessionManager();
    mgr.createSessionFromCookies("s1", [
      { name: "a", value: "b", domain: "d.com" },
    ]);
    mgr.createSessionFromCookies("s2", [
      { name: "c", value: "d", domain: "d.com" },
    ]);

    mgr.clearSession("s1");
    expect(mgr.getSession("s1")).toBeUndefined();
    expect(mgr.getSession("s2")).toBeDefined();
  });

  test("clear all: clearAllSessions empties the store", () => {
    const mgr = getSessionManager();
    mgr.createSessionFromCookies("s1", [
      { name: "a", value: "b", domain: "d.com" },
    ]);
    mgr.createSessionFromCookies("s2", [
      { name: "c", value: "d", domain: "d.com" },
    ]);

    mgr.clearAllSessions();
    expect(mgr.listSessions()).toEqual([]);
    expect(mgr.getSession("s1")).toBeUndefined();
    expect(mgr.getSession("s2")).toBeUndefined();
  });

  test("no credentials logging: auth module has no console logging of values", () => {
    const authSource = fs.readFileSync(
      path.join(__dirname, "../src/auth.ts"),
      "utf-8"
    );
    // Ensure no console.log, console.warn, console.error calls exist
    expect(authSource).not.toMatch(/console\.(log|warn|error)\s*\(/);
  });

  test("cookie defaults: missing optional fields get sensible defaults", () => {
    const mgr = getSessionManager();
    const state = mgr.createSessionFromCookies("defaults", [
      { name: "minimal", value: "val", domain: "test.com" },
    ]);

    const cookie = state.cookies[0];
    expect(cookie.path).toBe("/");
    expect(cookie.httpOnly).toBe(false);
    expect(cookie.secure).toBe(false);
    expect(cookie.sameSite).toBe("None");
    expect(cookie.expires).toBe(-1);
  });

  test("listSessions returns all session labels", () => {
    const mgr = getSessionManager();
    mgr.createSessionFromCookies("alpha", [
      { name: "a", value: "1", domain: "a.com" },
    ]);
    mgr.createSessionFromCookies("beta", [
      { name: "b", value: "2", domain: "b.com" },
    ]);

    const labels = mgr.listSessions();
    expect(labels).toContain("alpha");
    expect(labels).toContain("beta");
    expect(labels).toHaveLength(2);
  });
});

describe("interactive login", () => {
  beforeEach(() => {
    getSessionManager().clearAllSessions();
    vi.restoreAllMocks();
  });

  test("rejects concurrent login attempts", async () => {
    const { chromium } = await import("playwright");

    // Mock chromium.launch to return a browser that never disconnects
    const mockBrowser = {
      on: vi.fn(), // never calls the callback, so it hangs forever
      newContext: vi.fn().mockResolvedValue({
        newPage: vi.fn().mockResolvedValue({
          goto: vi.fn().mockResolvedValue(undefined),
        }),
        storageState: vi.fn().mockResolvedValue({
          cookies: [],
          origins: [],
        }),
      }),
      close: vi.fn(),
    };

    vi.spyOn(chromium, "launch").mockResolvedValue(mockBrowser as any);

    const mgr = getSessionManager();

    // Start first login (will hang because browser never disconnects)
    const firstLogin = mgr.interactiveLogin("https://example.com", "s1");

    // Wait a tick for the first call to proceed past the guard
    await new Promise((r) => setTimeout(r, 10));

    // Second login should throw
    await expect(
      mgr.interactiveLogin("https://example.com", "s2")
    ).rejects.toThrow("Another interactive login is already in progress");

    // Clean up: simulate browser disconnect to resolve firstLogin
    const disconnectCallback = mockBrowser.on.mock.calls.find(
      (call: any[]) => call[0] === "disconnected"
    );
    if (disconnectCallback) {
      disconnectCallback[1]();
    }

    // Wait for firstLogin to settle (it may throw due to null state timing, that's ok)
    try {
      await firstLogin;
    } catch {
      // Expected -- state may be null if interval hasn't fired yet
    }
  });

  test("stores session after browser close", async () => {
    const { chromium } = await import("playwright");

    const fakeState: StorageState = {
      cookies: [
        {
          name: "auth",
          value: "token123",
          domain: "example.com",
          path: "/",
          expires: -1,
          httpOnly: false,
          secure: false,
          sameSite: "None",
        },
      ],
      origins: [],
    };

    let disconnectCallback: (() => void) | undefined;

    const mockContext = {
      newPage: vi.fn().mockResolvedValue({
        goto: vi.fn().mockResolvedValue(undefined),
      }),
      storageState: vi.fn().mockResolvedValue(fakeState),
    };

    const mockBrowser = {
      on: vi.fn((event: string, cb: () => void) => {
        if (event === "disconnected") {
          disconnectCallback = cb;
        }
      }),
      newContext: vi.fn().mockResolvedValue(mockContext),
      close: vi.fn(),
    };

    vi.spyOn(chromium, "launch").mockResolvedValue(mockBrowser as any);

    const mgr = getSessionManager();
    const loginPromise = mgr.interactiveLogin("https://example.com/login", "mysite");

    // Wait for the interval to fire at least once (interval is 2s, but we can wait a bit)
    await new Promise((r) => setTimeout(r, 2500));

    // Simulate browser close
    disconnectCallback!();

    const result = await loginPromise;

    expect(result).toEqual(fakeState);
    expect(mgr.getSession("mysite")).toEqual(fakeState);
    expect(mgr.listSessions()).toContain("mysite");
  }, 10000);
});
