import { chromium } from "playwright";
import type { CookieInput, CookieParam, StorageState } from "./types.js";

/**
 * In-memory session manager for storing authentication state.
 * Stores Playwright-compatible StorageState objects keyed by label.
 *
 * SECURITY: No cookie values or session content are logged.
 */
class SessionManager {
  private sessions: Map<string, StorageState> = new Map();
  private loginInProgress = false;

  /**
   * Store a pre-built StorageState under the given label.
   */
  storeSession(label: string, state: StorageState): void {
    this.sessions.set(label, state);
  }

  /**
   * Retrieve a stored session by label, or undefined if not found.
   */
  getSession(label: string): StorageState | undefined {
    return this.sessions.get(label);
  }

  /**
   * Remove a specific session by label.
   */
  clearSession(label: string): void {
    this.sessions.delete(label);
  }

  /**
   * Remove all stored sessions.
   */
  clearAllSessions(): void {
    this.sessions.clear();
  }

  /**
   * List all stored session labels.
   */
  listSessions(): string[] {
    return Array.from(this.sessions.keys());
  }

  /**
   * Launch a headed browser for manual login, capture the session when the user closes it.
   * Only one interactive login can run at a time.
   */
  async interactiveLogin(url: string, sessionName: string): Promise<StorageState> {
    if (this.loginInProgress) {
      throw new Error(
        "Another interactive login is already in progress. Complete or close the current browser window first."
      );
    }

    this.loginInProgress = true;
    try {
      const browser = await chromium.launch({ headless: false });
      const context = await browser.newContext();
      const page = await context.newPage();
      await page.goto(url);

      let state: StorageState | null = null;

      const interval = setInterval(async () => {
        try {
          state = (await context.storageState()) as StorageState;
        } catch {
          // Browser may be closing, ignore errors
        }
      }, 2000);

      await new Promise<void>((resolve) => {
        browser.on("disconnected", () => resolve());
      });

      clearInterval(interval);

      if (state === null) {
        throw new Error(
          "No session state captured. The browser may have closed before login completed."
        );
      }

      this.storeSession(sessionName, state);
      return state;
    } finally {
      this.loginInProgress = false;
    }
  }

  /**
   * Create a StorageState from cookie inputs, applying defaults for optional fields.
   * Stores the session under the given label and returns the StorageState.
   */
  createSessionFromCookies(label: string, cookies: CookieInput[]): StorageState {
    const fullCookies: CookieParam[] = cookies.map((c) => ({
      name: c.name,
      value: c.value,
      domain: c.domain,
      path: c.path ?? "/",
      expires: c.expires ?? -1,
      httpOnly: c.httpOnly ?? false,
      secure: c.secure ?? false,
      sameSite: c.sameSite ?? "None",
    }));

    const state: StorageState = {
      cookies: fullCookies,
      origins: [],
    };

    this.sessions.set(label, state);
    return state;
  }
}

let instance: SessionManager | null = null;

/**
 * Get the singleton SessionManager instance.
 */
export function getSessionManager(): SessionManager {
  if (!instance) {
    instance = new SessionManager();
  }
  return instance;
}

export { SessionManager };
