import type { CookieInput, CookieParam, StorageState } from "./types.js";

/**
 * In-memory session manager for storing authentication state.
 * Stores Playwright-compatible StorageState objects keyed by label.
 *
 * SECURITY: No cookie values or session content are logged.
 */
class SessionManager {
  private sessions: Map<string, StorageState> = new Map();

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
