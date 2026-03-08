# Phase 3: Authentication - Research

**Researched:** 2026-03-08
**Domain:** Playwright browser authentication, session management, cookie injection
**Confidence:** HIGH

## Summary

Phase 3 adds authentication support to shotput so users can capture screenshots of pages behind login walls. Playwright provides first-class APIs for this: `browserContext.storageState()` captures cookies and localStorage from an authenticated session, `browser.newContext({ storageState })` restores that state into new contexts, and `context.addCookies()` allows programmatic cookie injection. The headed browser flow (`chromium.launch({ headless: false })`) enables manual login in a visible window.

The current codebase uses a singleton browser pattern in `browser.ts` with `chromium.launch({ headless: true })`. Authentication requires extending this to support: (1) launching a headed browser for interactive login, (2) extracting session state from that browser, (3) storing session state in memory for reuse across captures, and (4) accepting programmatically injected cookies/tokens. No new dependencies are needed -- Playwright provides all required APIs.

**Primary recommendation:** Create an `auth.ts` session manager that stores session state (cookies + localStorage) in memory, provides interactive login via headed browser, accepts programmatic cookie injection, and integrates with the existing capture pipeline by passing `storageState` when creating browser contexts.

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| AUTH-01 | User can open a headed browser, log in manually, and have session transferred to headless captures | Playwright `chromium.launch({ headless: false })` + `context.storageState()` captures full session; `browser.newContext({ storageState })` restores it |
| AUTH-02 | User can inject cookies or session tokens programmatically | `context.addCookies()` accepts cookie arrays with full attribute control (domain, path, httpOnly, secure, sameSite, expires) |
| AUTH-03 | Sessions persist across multiple captures within same MCP server session | In-memory session store keyed by domain/label; `storageState` object reused across `newContext()` calls |
| AUTH-04 | No credentials stored or logged -- only session state captured | `storageState()` captures only cookies + localStorage, never form inputs or passwords; ensure no logging of cookie values |
</phase_requirements>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| playwright | ^1.58.2 | Browser automation, auth APIs | Already in project; provides storageState, addCookies, headed mode natively |

### Supporting
No new dependencies needed. All authentication capabilities are built into Playwright.

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| In-memory session store | File-based storageState JSON | File persistence survives MCP server restart but adds disk I/O and security risk (credentials on disk); requirements say same-session only |
| `launchPersistentContext()` | `launch()` + manual storageState | Persistent context auto-saves profile to disk, but harder to control, shares state unexpectedly, and violates AUTH-04 spirit |

## Architecture Patterns

### Recommended Project Structure
```
src/
  auth.ts            # NEW: Session manager (store, interactive login, cookie injection)
  browser.ts         # MODIFIED: Support headed launch, accept storageState
  capture.ts         # MODIFIED: Pass session state to context creation
  server.ts          # MODIFIED: Register new MCP tools (shotput_login, shotput_set_cookies)
  types.ts           # MODIFIED: Add auth-related types
```

### Pattern 1: Session Manager (In-Memory Store)
**What:** A module that holds session state (storageState objects) in memory, keyed by a label or domain.
**When to use:** Always -- this is the core of the auth system.
**Example:**
```typescript
// Source: Playwright docs https://playwright.dev/docs/auth
interface StorageState {
  cookies: Array<{
    name: string;
    value: string;
    domain: string;
    path: string;
    expires: number;
    httpOnly: boolean;
    secure: boolean;
    sameSite: "Strict" | "Lax" | "None";
  }>;
  origins: Array<{
    origin: string;
    localStorage: Array<{ name: string; value: string }>;
  }>;
}

// In-memory session store
const sessions = new Map<string, StorageState>();

function storeSession(label: string, state: StorageState): void {
  sessions.set(label, state);
}

function getSession(label: string): StorageState | undefined {
  return sessions.get(label);
}
```

### Pattern 2: Interactive Login Flow
**What:** Launch headed browser, let user log in, capture storageState, close headed browser.
**When to use:** AUTH-01 -- manual login for complex auth (OAuth, 2FA, CAPTCHAs).
**Example:**
```typescript
// Source: Playwright docs https://playwright.dev/docs/api/class-browsertype
async function interactiveLogin(url: string, label: string): Promise<StorageState> {
  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext();
  const page = await context.newPage();
  await page.goto(url);

  // Wait for user to complete login -- detect by URL change or explicit signal
  // Option A: wait for navigation away from login page
  // Option B: wait for a specific cookie to appear
  // Option C: user closes the page / clicks a "done" button injected by us

  const state = await context.storageState();
  await browser.close();
  return state;
}
```

### Pattern 3: Programmatic Cookie Injection
**What:** Accept cookie array from MCP tool params, store as session state.
**When to use:** AUTH-02 -- when user has cookies/tokens from other sources.
**Example:**
```typescript
// Source: Playwright docs https://playwright.dev/docs/api/class-browsercontext
function createSessionFromCookies(
  label: string,
  cookies: Array<{ name: string; value: string; domain: string; path?: string; httpOnly?: boolean; secure?: boolean; sameSite?: "Strict" | "Lax" | "None"; expires?: number }>
): StorageState {
  return {
    cookies: cookies.map(c => ({
      name: c.name,
      value: c.value,
      domain: c.domain,
      path: c.path ?? "/",
      expires: c.expires ?? -1,
      httpOnly: c.httpOnly ?? false,
      secure: c.secure ?? false,
      sameSite: c.sameSite ?? "None",
    })),
    origins: [],
  };
}
```

### Pattern 4: Authenticated Capture Context
**What:** When creating a browser context for capture, optionally pass storageState.
**When to use:** Every capture that references a session.
**Example:**
```typescript
// Modified from existing capture.ts pattern
const contextOptions: any = {
  viewport: { width, height },
  deviceScaleFactor: scale,
};
if (sessionLabel && sessions.has(sessionLabel)) {
  contextOptions.storageState = sessions.get(sessionLabel);
}
const context = await browser.newContext(contextOptions);
```

### Anti-Patterns to Avoid
- **Launching a separate headed browser singleton alongside headless:** Use a separate, short-lived headed browser instance for login only. Do not modify the existing headless singleton.
- **Using `launchPersistentContext()` for auth:** Persistent contexts save data to disk, create coupling between sessions, and make cleanup harder. Use `storageState` objects in memory instead.
- **Storing storageState to disk by default:** Violates the spirit of AUTH-04. Keep in memory only. If we ever add persistence, it should be opt-in and clearly documented.
- **Polling for login completion:** Instead of polling cookies, use `page.waitForURL()` or `page.waitForEvent('close')` which are event-driven.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Cookie serialization/deserialization | Custom cookie parser | Playwright `storageState()` / `addCookies()` | Handles httpOnly, secure, sameSite, domain matching, expiry correctly |
| Session storage capture | Manual DOM scraping of localStorage | Playwright `storageState()` captures localStorage per origin | Handles all origins, proper serialization |
| Headed browser management | Custom X11/display logic | Playwright `chromium.launch({ headless: false })` | Works cross-platform (macOS, Linux, Windows) |
| Cookie domain matching | Regex domain matching for applying cookies | Playwright `newContext({ storageState })` | Correct cookie scoping by domain/path |

**Key insight:** Playwright's `storageState` is the canonical way to transfer authentication state between contexts. It captures cookies AND localStorage, handles all cookie attributes correctly, and can be passed directly to `newContext()`. There is zero reason to build custom session management.

## Common Pitfalls

### Pitfall 1: Headed Browser on Headless Servers
**What goes wrong:** `chromium.launch({ headless: false })` fails on CI/servers without a display.
**Why it happens:** No X server or Wayland display available.
**How to avoid:** The interactive login tool description should clearly state it requires a display. This is fine for shotput's use case (developer's local machine), but error handling should provide a clear message.
**Warning signs:** Error message "Looks like you launched a headed browser without having a XServer running."

### Pitfall 2: Cookie Expiration
**What goes wrong:** Stored session becomes stale because cookies expire.
**Why it happens:** Session cookies have expiry times; the stored state doesn't auto-refresh.
**How to avoid:** Document that sessions are ephemeral (same MCP server session). If a capture fails with auth errors, user should re-login. Consider adding session age metadata.
**Warning signs:** Authenticated captures suddenly return login pages.

### Pitfall 3: Detecting Login Completion
**What goes wrong:** The tool captures storageState before the user has finished logging in.
**Why it happens:** No reliable universal signal that login is "complete."
**How to avoid:** Use `page.waitForEvent('close')` -- let the user close the browser tab/window when done. This is the most universal signal. Alternatively, inject a "Click when done" overlay. For safety, also support `page.waitForURL()` with a pattern the user can specify.
**Warning signs:** StorageState captured with no auth cookies.

### Pitfall 4: httpOnly Cookies Not Accessible via JS
**What goes wrong:** Trying to read auth cookies via `page.evaluate(() => document.cookie)`.
**Why it happens:** httpOnly cookies are invisible to JavaScript.
**How to avoid:** Always use `context.cookies()` or `context.storageState()` which access cookies at the browser level, not via page JavaScript.
**Warning signs:** Missing auth cookies in captured state.

### Pitfall 5: Multiple Headed Browser Windows
**What goes wrong:** If user triggers interactive login while another is in progress, multiple headed browsers appear.
**Why it happens:** No mutex on the interactive login flow.
**How to avoid:** Track whether an interactive login is in progress; reject concurrent requests with a clear error message.
**Warning signs:** Multiple browser windows open simultaneously.

### Pitfall 6: SameSite Cookie Issues
**What goes wrong:** Cookies with `SameSite=Strict` or `SameSite=Lax` may not be sent on cross-origin navigations.
**Why it happens:** Browser enforces SameSite policy.
**How to avoid:** Playwright's `storageState` captures the sameSite attribute and restores it correctly. No special handling needed as long as we use the storageState API rather than manually constructing cookies.
**Warning signs:** Authentication works on the login domain but fails on subdomains or related domains.

## Code Examples

Verified patterns from official sources:

### Capturing Storage State After Login
```typescript
// Source: https://playwright.dev/docs/auth
const context = await browser.newContext();
const page = await context.newPage();
await page.goto('https://example.com/login');
// ... user performs login ...
const storageState = await context.storageState();
// storageState contains { cookies: [...], origins: [...] }
```

### Creating Context with Saved State
```typescript
// Source: https://playwright.dev/docs/auth
const context = await browser.newContext({
  storageState: {
    cookies: [...],
    origins: [...]
  }
});
// All pages in this context have the auth cookies
```

### Adding Cookies Programmatically
```typescript
// Source: https://playwright.dev/docs/api/class-browsercontext
await context.addCookies([{
  name: 'session_id',
  value: 'abc123',
  domain: '.example.com',
  path: '/',
  httpOnly: true,
  secure: true,
  sameSite: 'Lax',
  expires: Math.floor(Date.now() / 1000) + 3600,
}]);
```

### Launching Headed Browser
```typescript
// Source: https://playwright.dev/docs/api/class-browsertype
const browser = await chromium.launch({
  headless: false,
  // slowMo: 100, // optional: slow down for visibility
});
```

### Waiting for User to Close Browser
```typescript
// Wait for all pages to close (user closes the window)
const page = await context.newPage();
await page.goto(url);
await new Promise<void>((resolve) => {
  context.on('close', () => resolve());
  // Also handle: browser might be closed directly
  browser.on('disconnected', () => resolve());
});
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Puppeteer cookies API | Playwright storageState | Playwright 1.0+ (2020) | storageState captures cookies + localStorage together |
| `page.setCookie()` (Puppeteer) | `context.addCookies()` (Playwright) | Playwright 1.0+ | Context-level, not page-level |
| File-based persistent profiles | In-memory storageState objects | Current best practice | Safer, more controlled, no disk side effects |

**Deprecated/outdated:**
- `launchPersistentContext()` for auth: Still works but not recommended for session transfer between headed/headless. Use `storageState` instead.

## Open Questions

1. **How should the user signal login completion in interactive mode?**
   - What we know: `page.waitForEvent('close')` works when user closes the window. `page.waitForURL()` works if we know the post-login URL.
   - What's unclear: Best UX for MCP context where Claude is orchestrating.
   - Recommendation: Default to waiting for user to close the browser window. This is universal and requires no knowledge of the target site. The MCP tool can instruct: "Log in, then close the browser window when done."

2. **Should sessions be keyed by domain or by user-provided label?**
   - What we know: Domain-keying is automatic but limits one session per domain. Label-keying is flexible but requires user to remember labels.
   - What's unclear: Which is more ergonomic for MCP tool usage.
   - Recommendation: Use a user-provided `sessionName` label with a sensible default derived from the URL domain. This allows multiple sessions per domain if needed (e.g., admin vs. regular user).

3. **Should `shotput_capture` automatically use stored sessions?**
   - What we know: Capture currently creates fresh contexts with no auth.
   - What's unclear: Whether to auto-match by domain or require explicit session reference.
   - Recommendation: Add optional `sessionName` parameter to `shotput_capture`. If provided, use that session. If not provided, no auth. Keep it explicit -- implicit domain matching is fragile and surprising.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | vitest (latest) |
| Config file | `vitest.config.ts` |
| Quick run command | `npx vitest run tests/auth.test.ts -x` |
| Full suite command | `npx vitest run --reporter=verbose` |

### Phase Requirements to Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| AUTH-01 | Interactive login captures storageState | integration | `npx vitest run tests/auth.test.ts -t "interactive login" -x` | No - Wave 0 |
| AUTH-02 | Programmatic cookie injection creates valid session | unit | `npx vitest run tests/auth.test.ts -t "cookie injection" -x` | No - Wave 0 |
| AUTH-03 | Session persists across multiple captures | integration | `npx vitest run tests/auth.test.ts -t "session persistence" -x` | No - Wave 0 |
| AUTH-04 | No credentials in logs or storage | unit | `npx vitest run tests/auth.test.ts -t "no credentials" -x` | No - Wave 0 |

### Sampling Rate
- **Per task commit:** `npx vitest run tests/auth.test.ts -x`
- **Per wave merge:** `npx vitest run --reporter=verbose`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `tests/auth.test.ts` -- covers AUTH-01 through AUTH-04
- [ ] Test fixture: local HTTP server with login form for testing interactive flow (may reuse existing fixtures pattern)

## Sources

### Primary (HIGH confidence)
- [Playwright Authentication docs](https://playwright.dev/docs/auth) - storageState patterns, session reuse, API auth
- [Playwright BrowserContext API](https://playwright.dev/docs/api/class-browsercontext) - storageState(), addCookies(), cookies(), clearCookies() full TypeScript signatures
- [Playwright BrowserType API](https://playwright.dev/docs/api/class-browsertype) - launch() and launchPersistentContext() options including headless

### Secondary (MEDIUM confidence)
- [BrowserStack Playwright cookies guide](https://www.browserstack.com/guide/playwright-cookies) - practical cookie management patterns
- [BrowserStack storageState guide](https://www.browserstack.com/guide/playwright-storage-state) - storageState usage patterns

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - Playwright's built-in auth APIs are well-documented and stable
- Architecture: HIGH - storageState pattern is the canonical Playwright approach, verified via official docs
- Pitfalls: HIGH - common issues well-documented in Playwright community and official docs

**Research date:** 2026-03-08
**Valid until:** 2026-04-08 (Playwright API is stable; 30 days)
