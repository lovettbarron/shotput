# Domain Pitfalls

**Domain:** Headless browser screenshot capture tool (MCP server + Claude Code skill)
**Researched:** 2026-03-07

## Critical Pitfalls

Mistakes that cause rewrites, security incidents, or major user-facing failures.

### Pitfall 1: Zombie Browser Processes and Memory Leaks

**What goes wrong:** Chromium processes accumulate when `browser.close()` fails silently, error paths skip cleanup, or the MCP server crashes mid-capture. Each orphaned Chrome process consumes 100-300MB RAM. On Linux specifically, `browser.close()` intermittently fails to terminate processes, creating zombies.

**Why it happens:** Error handling paths miss cleanup. Unhandled promise rejections kill the Node process without closing Chrome. The MCP server transport (stdio) can be terminated by the client at any time without warning, leaving browser processes running. In Docker environments, PID 1 signal handling behaves differently, preventing proper child process reaping.

**Consequences:** Host machine runs out of memory. Users report "Shotput slows down my machine." In long-running MCP server sessions, dozens of orphaned Chrome processes accumulate silently.

**Prevention:**
- Use `try/finally` around ALL browser operations, never `try/catch` alone
- Implement a process-level cleanup handler that tracks all spawned Chrome PIDs and kills them on `SIGTERM`, `SIGINT`, `SIGHUP`, and `exit`
- Set a hard timeout on every browser operation (navigate, screenshot, element query) -- 30 seconds max
- On MCP server shutdown, enumerate and kill all child Chrome processes by PID, not just call `browser.close()`
- Consider single-browser-instance architecture: reuse one browser with fresh pages/contexts rather than launching new browsers per request
- Log Chrome process count as a health metric

**Detection:** Monitor process count on host. If Chrome processes > expected count, cleanup is broken. Add a `/health` or diagnostic tool that reports active browser count.

**Phase:** Phase 1 (Core capture). This must be correct from day one -- retrofitting cleanup is painful.

**Confidence:** HIGH -- well-documented across [Puppeteer issue #5279](https://github.com/puppeteer/puppeteer/issues/5279), [issue #12186](https://github.com/puppeteer/puppeteer/issues/12186), [issue #1825](https://github.com/puppeteer/puppeteer/issues/1825), and [this Medium post](https://medium.com/@matveev.dina/the-hidden-cost-of-headless-browsers-a-puppeteer-memory-leak-journey-027e41291367).

---

### Pitfall 2: Screenshot Timing -- Capturing Before the Page Is Ready

**What goes wrong:** Screenshots capture blank areas, missing images, half-rendered content, or loading spinners. Full-page screenshots of pages with lazy-loaded content show placeholder boxes below the fold. SPAs that fetch data after initial render produce screenshots of loading states.

**Why it happens:** There is no universal "page is fully loaded" signal. `networkidle0` fails on pages with persistent WebSocket connections or analytics pings. `networkidle2` fires too early on pages that fetch data in cascading requests. Lazy-loaded images only load when scrolled into view, but full-page screenshots measure page height without triggering scroll events.

**Consequences:** Users get broken screenshots and lose trust in the tool. Worse, they may not notice the issue for subtle cases (missing one image in a gallery).

**Prevention:**
- Default wait strategy: `domcontentloaded` + `waitForNetworkIdle({ idleTime: 500 })` as a baseline
- For full-page screenshots: scroll the entire page height first to trigger lazy-load observers, wait for network idle again, then capture
- Expose a `waitFor` parameter in the MCP tool: `selector` (wait for specific element), `timeout` (custom wait), `networkIdle` (tunable idle time)
- Add an optional `delay` parameter (simple but effective for animations settling)
- Document that no single strategy works for all sites -- the tool should make it easy to customize per-capture

**Detection:** Visual inspection of output. Automated detection is hard, but checking that screenshot dimensions match expected viewport and that file size is above a minimum threshold can catch blank-page captures.

**Phase:** Phase 1 (Core capture). The wait strategy is fundamental to the capture pipeline.

**Confidence:** HIGH -- [Puppeteer issue #3202](https://github.com/GoogleChrome/puppeteer/issues/3202), [issue #2569](https://github.com/puppeteer/puppeteer/issues/2569), [BrowserStack guide](https://www.browserstack.com/guide/puppeteer-waituntil), [Screenshotone blog](https://screenshotone.com/blog/puppeteer-wait-until-the-page-is-ready/).

---

### Pitfall 3: Security Risks from Navigating to Arbitrary URLs

**What goes wrong:** The MCP server navigates a real browser to user-supplied URLs. Malicious or compromised pages can exploit browser vulnerabilities for remote code execution. Even without exploits, SSRF attacks let pages probe internal network services (cloud metadata endpoints at `169.254.169.254`, localhost services, internal APIs).

**Why it happens:** Headless Chrome is a full browser -- JavaScript runs with full capability. Many headless deployments disable the sandbox (`--no-sandbox`) for Docker compatibility, removing the primary security boundary. The DevTools Protocol debug interface on `localhost:9222` can be accessed by malicious pages to control the browser.

**Consequences:** Local network scanning. Reading cloud metadata credentials. In worst case, arbitrary code execution on the user's machine. Since Shotput runs locally (not in a sandbox), a compromised browser has access to everything the user does.

**Prevention:**
- NEVER use `--no-sandbox` -- use Chromium's built-in sandbox. If users hit permission issues, document the fix (proper user namespaces on Linux) rather than disabling the sandbox
- Block navigation to internal network ranges: reject URLs resolving to `127.0.0.0/8`, `10.0.0.0/8`, `172.16.0.0/12`, `192.168.0.0/16`, `169.254.0.0/16` unless the user explicitly requests localhost capture (which is a core use case -- handle with a flag)
- Do NOT expose the DevTools Protocol port externally -- bind to a random port, not the default 9222
- Set `--disable-dev-shm-usage` for Docker but never `--no-sandbox`
- Limit navigation timeout to prevent resource exhaustion from slow-loading attack pages
- Since Shotput explicitly supports localhost URLs (for dev server screenshots), implement a clear trust model: localhost is allowed by default, internal network ranges require explicit opt-in

**Detection:** Network monitoring for unexpected outbound connections from Chrome. Log all navigated URLs.

**Phase:** Phase 1 (Core capture). Security architecture must be designed in, not bolted on.

**Confidence:** HIGH -- [Puppeteer security writeup](https://medium.com/nerd-for-tech/hacking-puppeteer-what-to-expect-if-you-put-a-browser-on-the-internet-6c3dad0756db), [SSRF circumvention research](https://httpvoid.com/Circumventing-Browser-Security-Mechanisms-For-SSRF.md), [Chrome sandbox escape CVE-2025-2783](https://www.sangfor.com/farsight-labs-threat-intelligence/cybersecurity/cve-2025-2783-google-chrome-sandbox-escape).

---

### Pitfall 4: Chromium Binary Management Nightmare

**What goes wrong:** Users install the npm package and immediately hit a 170-280MB Chromium download. CI/CD environments fail because the download is blocked. Corporate proxies interfere. The cached binary at `$HOME/.cache/puppeteer` gets stale or corrupted. Different machines have different Chrome versions producing subtly different renders.

**Why it happens:** Puppeteer bundles Chrome for Testing (~280MB) on `npm install`. This works for development but creates friction for every other context: CI, Docker, air-gapped environments, slow connections. Using `puppeteer-core` with a system Chrome avoids the download but introduces version mismatch risks.

**Consequences:** Poor first-run experience ("why is npm install taking 5 minutes?"). CI failures. Inconsistent rendering across team members using different Chrome versions. Users opening issues about install failures.

**Prevention:**
- Use `puppeteer-core` (no bundled browser) and detect/use system Chrome as the default strategy
- Provide a `shotput setup` command or MCP tool that downloads a known-good Chrome version to a project-local cache
- Document supported Chrome version range and test against it
- For the MCP server, validate Chrome availability on startup and return a clear error with install instructions if missing
- Set `PUPPETEER_CACHE_DIR` to a project-relative location rather than relying on `$HOME/.cache`
- Pin the Chrome for Testing version in the project config, not just Puppeteer's default

**Detection:** Startup health check that validates Chrome binary exists and reports its version. Clear error messages, not cryptic ENOENT crashes.

**Phase:** Phase 1 (Core infrastructure). The install experience is the user's first impression.

**Confidence:** HIGH -- [Puppeteer installation docs](https://pptr.dev/guides/installation), [Puppeteer issue #3027](https://github.com/puppeteer/puppeteer/issues/3027).

---

### Pitfall 5: MCP Server Lifecycle Mismanagement

**What goes wrong:** The MCP server starts a long-lived browser process but the MCP client (Claude Code) can terminate the stdio transport at any time. The server doesn't handle graceful shutdown, leaving browsers running. Errors in one tool call crash the entire server process, killing all in-progress operations. Server startup is slow because it eagerly launches Chrome.

**Why it happens:** MCP stdio transport gives the server no warning before the client closes stdin. Developers treat the MCP server like a request-response API but it's actually a long-lived process with lifecycle responsibilities. The MCP spec defines initialization/shutdown sequences but many implementations skip proper cleanup.

**Consequences:** Zombie Chrome processes (compounds Pitfall 1). Lost screenshots mid-capture. Users must manually kill processes. Server crashes require restarting the MCP client.

**Prevention:**
- Lazy browser initialization: don't launch Chrome until the first capture request. This makes server startup instant
- Handle `SIGTERM`, `SIGINT`, `SIGHUP`, and stdin close (`end` event) to trigger graceful shutdown
- Wrap every tool handler in error boundaries -- a single tool failure must never crash the server
- Implement request-level timeouts: if a capture takes longer than 60 seconds, abort and return an error
- Use `process.on('exit')` as a last-resort cleanup to kill Chrome processes
- Follow the MCP lifecycle spec: respond to `shutdown` requests, send proper error responses rather than crashing

**Detection:** Test the shutdown path explicitly: start server, make requests, kill the client process, verify no orphaned Chrome processes remain.

**Phase:** Phase 1 (MCP server architecture). The lifecycle is foundational.

**Confidence:** HIGH -- [MCP Lifecycle spec](https://modelcontextprotocol.io/specification/2025-03-26/basic/lifecycle), [MCP error handling guide](https://mcpcat.io/guides/error-handling-custom-mcp-servers/).

## Moderate Pitfalls

### Pitfall 6: Font Rendering Inconsistency Across Platforms

**What goes wrong:** The same URL produces visually different screenshots on macOS vs Linux vs Windows. Text wraps at different points. Font weights look different. Users on macOS get crisp text while Linux CI produces blurry or differently-spaced text.

**Why it happens:** Font hinting differs between platforms. macOS uses less hinting (truer to font design, slightly blurrier). Windows uses heavy hinting (sharper but distorted). Linux varies by distribution and fontconfig settings. Headless mode may render differently than headful mode due to font spacing bugs in Chromium. Missing fonts on Linux servers cause fallback to generic fonts.

**Prevention:**
- Launch Chrome with `--font-render-hinting=none` to normalize rendering across platforms
- Document that cross-platform screenshot consistency is not guaranteed (and this is a Chromium limitation, not a Shotput bug)
- For Linux environments, document required font packages: `fonts-liberation`, `fonts-noto`, `fonts-noto-cjk` for CJK support
- Do NOT promise pixel-perfect cross-platform consistency -- it's not achievable
- If visual regression testing is added later, use tolerance-based comparison (e.g., 0.1% pixel difference threshold)

**Detection:** Run the same capture on macOS and Linux in CI. If results differ beyond tolerance, font rendering configuration needs tuning.

**Phase:** Phase 1 (documentation), Phase 2+ (if visual consistency features are added).

**Confidence:** HIGH -- [Playwright issue #20097](https://github.com/microsoft/playwright/issues/20097), [Chromium bug #744577](https://bugs.chromium.org/p/chromium/issues/detail?id=744577), [Puppeteer issue #661](https://github.com/puppeteer/puppeteer/issues/661).

---

### Pitfall 7: Cookie/Session Security When Handling Authentication

**What goes wrong:** Authentication tokens are logged to console output, stored in plaintext in browser profile directories, or persisted in the MCP server's memory after the capture completes. The interactive login flow (opening a visible browser for the user to authenticate) leaks the `userDataDir` containing session cookies to disk, where they persist indefinitely.

**Why it happens:** Cookie injection and session persistence are necessary for authenticated screenshots, but developers treat auth tokens like regular parameters rather than secrets. Browser profile directories (`userDataDir`) store cookies in SQLite databases on disk. The MCP protocol transmits tool arguments (including cookie values) over stdio in plaintext.

**Consequences:** Session tokens from the user's real accounts persist on disk. If the machine is compromised, attackers get authenticated sessions. Log files contain bearer tokens.

**Prevention:**
- Use incognito/private browser contexts (not persistent `userDataDir`) for cookie injection captures
- For the interactive login flow: use a temporary `userDataDir`, extract only the needed cookies, then delete the profile directory
- Never log cookie values or auth tokens -- redact in all log output
- Clear browser cookies/storage after each capture completes
- Document that cookie injection passes tokens through the MCP protocol in plaintext (inherent to MCP stdio transport)
- For the interactive auth flow: set a session timeout -- don't let captured auth sessions persist forever

**Detection:** After a capture, check that no browser profile directories remain in temp storage. Grep logs for cookie patterns.

**Phase:** Phase 2 (Authentication features). Design the auth architecture with security from the start.

**Confidence:** MEDIUM -- synthesized from [cookie management pitfalls](https://latenode.com/blog/web-automation-scraping/puppeteer-fundamentals-setup/cookie-management-in-puppeteer-session-preservation-auth-emulation-and-limitations) and [Puppeteer session management](https://www.browserless.io/blog/manage-sessions).

---

### Pitfall 8: Large Screenshot File Sizes

**What goes wrong:** Full-page screenshots of long pages produce 5-15MB PNG files. Users capturing multiple pages fill disk quickly. Sending large screenshots back through the MCP protocol is slow. Claude Code may struggle to display or process very large images.

**Why it happens:** PNG is lossless -- a full-page capture of a content-rich page at 1920px width can easily be 10MB+. Full-page mode measures the entire scrollable height, which for some pages is thousands of pixels.

**Consequences:** Slow MCP responses. Excessive disk usage. Users expect "just a screenshot" to be fast and small.

**Prevention:**
- Default to JPEG at quality 85 for captures, not PNG. PNG only when user explicitly needs lossless (alpha transparency, pixel-perfect)
- Support WebP as an option (25-35% smaller than JPEG at equivalent quality)
- Set a maximum page height for full-page captures (e.g., 16384px) with a warning if truncated
- Return the file path through MCP rather than the image data itself -- let the client decide whether to read the file
- Consider using `sharp` for post-capture compression if needed
- Expose format and quality as parameters with sensible defaults

**Detection:** Log file sizes. Alert if any screenshot exceeds 5MB. Track average file size over time.

**Phase:** Phase 1 (Core capture). Format and quality defaults are part of the capture pipeline.

**Confidence:** HIGH -- [Bannerbear optimization guide](https://www.bannerbear.com/blog/ways-to-speed-up-puppeteer-screenshots/), [Latenode size optimization](https://latenode.com/blog/taking-screenshots-with-puppeteer-full-page-captures-elements-and-size-optimization).

---

### Pitfall 9: Test Flakiness with Screenshot-Based Tests

**What goes wrong:** Tests that verify screenshot output pass locally but fail in CI. Tests that rely on specific pixel values break when Chrome updates. Tests that navigate to external URLs fail when those sites change or are unavailable. Tests that share browser state interfere with each other.

**Why it happens:** Screenshots are influenced by Chrome version, OS, installed fonts, viewport timing, and network conditions. Even a minor Chrome update can shift rendering by 1-2 pixels. External URLs are not under test control.

**Consequences:** CI pipeline becomes unreliable. Developers start ignoring test failures. Excessive time spent debugging flaky tests instead of building features.

**Prevention:**
- Test against local HTML fixtures, never external URLs, for deterministic tests
- Use tolerance-based image comparison (allow small pixel differences), not exact byte equality
- Pin the Chrome for Testing version in CI
- Isolate each test: fresh browser context, no shared state
- Separate unit tests (capture logic, parameter validation) from integration tests (actual screenshots)
- Run screenshot comparison tests only on one platform (Linux in CI) and accept platform differences
- Use snapshot testing with manual review for visual changes rather than asserting exact pixel values

**Detection:** Track flaky test rate. If a test fails >5% of runs, it's flaky and needs redesign.

**Phase:** Phase 1 (Test infrastructure). Set up the right testing patterns before writing many tests.

**Confidence:** MEDIUM -- synthesized from [BrowserStack flaky tests guide](https://www.browserstack.com/guide/playwright-flaky-tests) and general testing best practices.

## Minor Pitfalls

### Pitfall 10: License Compliance Gaps

**What goes wrong:** A transitive dependency uses GPL, making the MIT/Apache-2.0 license choice problematic. Bundled fonts carry restrictive licenses. Chromium's own license (BSD-style) is compatible but requires attribution that gets missed.

**Prevention:**
- Run `npx license-checker --production --onlyAllow "MIT;Apache-2.0;BSD-2-Clause;BSD-3-Clause;ISC;0BSD"` in CI to catch incompatible licenses
- Never bundle fonts -- use system fonts or document which fonts users should install
- Include a NOTICE file with attribution for Chromium and significant dependencies
- Puppeteer itself is Apache-2.0, which is compatible with both MIT and Apache-2.0 project licenses

**Phase:** Phase 1 (Project setup). Run the license check from day one.

**Confidence:** HIGH -- [Puppeteer license](https://github.com/puppeteer/puppeteer/blob/main/LICENSE) is Apache-2.0.

---

### Pitfall 11: Cross-Platform Path and Environment Differences

**What goes wrong:** File paths use hardcoded `/` separators and break on Windows. Temp directory locations differ. Chrome binary paths differ across platforms. Environment variables for proxy settings differ.

**Prevention:**
- Use `path.join()` and `os.tmpdir()` everywhere, never string concatenation for paths
- Use Puppeteer's built-in browser detection rather than hardcoding Chrome paths
- Test the install flow on macOS, Linux, and Windows (at minimum via CI matrix)
- Use `$HOME` resolution via `os.homedir()`, not hardcoded paths

**Phase:** Phase 1. Path handling must be correct from the start.

**Confidence:** HIGH -- standard cross-platform Node.js concerns.

---

### Pitfall 12: Choosing the Wrong Open Source License

**What goes wrong:** Picking MIT when Apache-2.0 would provide better patent protection. Or picking a copyleft license that limits adoption. Not including a `LICENSE` file. Missing contributor license agreement for accepting PRs.

**Prevention:**
- Apache-2.0 is the better choice for this project: it includes patent grants (protects contributors and users), is compatible with Puppeteer's Apache-2.0 license, and is standard for developer tools
- Include `LICENSE` file at repo root from the first commit
- Add license headers to source files or configure a check
- A CLA is unnecessary at this stage -- the Apache-2.0 license itself provides sufficient contributor protections for a small project

**Phase:** Phase 0 (Repository setup). License must be set before any code is public.

**Confidence:** HIGH -- standard open source practice. PROJECT.md already identifies MIT or Apache-2.0 as the target.

## Phase-Specific Warnings

| Phase Topic | Likely Pitfall | Mitigation |
|-------------|---------------|------------|
| Core capture (Phase 1) | Zombie processes, timing failures, large files | Process tracking, multi-strategy waits, JPEG defaults |
| MCP server (Phase 1) | Lifecycle crashes, no graceful shutdown | Error boundaries, signal handlers, lazy browser init |
| Authentication (Phase 2) | Session token leakage, cookie persistence on disk | Incognito contexts, temp profiles, token scrubbing |
| Element targeting (Phase 2) | Claude-generated selectors finding wrong elements | Verification step: screenshot the element, let Claude confirm |
| Dark mode toggle (Phase 2) | `prefers-color-scheme` emulation not working on all sites | Some sites use JS-based theme toggle, not media query |
| opencode compatibility (Final) | Different MCP client behaviors, missing features | Test against opencode early, don't assume Claude Code behavior |
| CI/CD & testing | Font differences breaking visual assertions | Pin Chrome version, tolerance-based comparison, Linux-only visual tests |

## Sources

- [Puppeteer zombie process issue #5279](https://github.com/puppeteer/puppeteer/issues/5279)
- [Puppeteer memory leak journey](https://medium.com/@matveev.dina/the-hidden-cost-of-headless-browsers-a-puppeteer-memory-leak-journey-027e41291367)
- [Puppeteer browser.close issue #12186](https://github.com/puppeteer/puppeteer/issues/12186)
- [Puppeteer lazy-load screenshot issue #3202](https://github.com/GoogleChrome/puppeteer/issues/3202)
- [Puppeteer waitUntil guide](https://www.browserstack.com/guide/puppeteer-waituntil)
- [SSRF via headless browsers](https://httpvoid.com/Circumventing-Browser-Security-Mechanisms-For-SSRF.md)
- [Hacking Puppeteer security writeup](https://medium.com/nerd-for-tech/hacking-puppeteer-what-to-expect-if-you-put-a-browser-on-the-internet-6c3dad0756db)
- [Chrome sandbox escape CVE-2025-2783](https://www.sangfor.com/farsight-labs-threat-intelligence/cybersecurity/cve-2025-2783-google-chrome-sandbox-escape)
- [Playwright font rendering issue #20097](https://github.com/microsoft/playwright/issues/20097)
- [Chromium font rendering bug #744577](https://bugs.chromium.org/p/chromium/issues/detail?id=744577)
- [Puppeteer installation docs](https://pptr.dev/guides/installation)
- [MCP Lifecycle specification](https://modelcontextprotocol.io/specification/2025-03-26/basic/lifecycle)
- [MCP error handling guide](https://mcpcat.io/guides/error-handling-custom-mcp-servers/)
- [Puppeteer cookie management pitfalls](https://latenode.com/blog/web-automation-scraping/puppeteer-fundamentals-setup/cookie-management-in-puppeteer-session-preservation-auth-emulation-and-limitations)
- [Screenshot size optimization](https://www.bannerbear.com/blog/ways-to-speed-up-puppeteer-screenshots/)
- [Playwright flaky tests guide](https://www.browserstack.com/guide/playwright-flaky-tests)
- [Puppeteer license (Apache-2.0)](https://github.com/puppeteer/puppeteer/blob/main/LICENSE)
