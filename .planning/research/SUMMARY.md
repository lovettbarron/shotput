# Project Research Summary

**Project:** Shotput -- Headless Browser Screenshot Tool (MCP Server + Claude Code Skill)
**Domain:** Developer tooling / browser automation / MCP ecosystem
**Researched:** 2026-03-07
**Confidence:** HIGH

## Executive Summary

Shotput is a two-layer developer tool: an MCP server that wraps Playwright for headless browser screenshot capture, and a Claude Code skill that provides natural language orchestration on top. The expert approach for this type of tool is well-established -- Playwright is the clear winner over Puppeteer for browser automation in 2026 (cross-browser, better API, active community), the MCP TypeScript SDK v1.x is stable and production-ready, and the coarse-grained tool design pattern (5-7 intent-based tools, not thin API wrappers) is the documented best practice for MCP servers. The technology choices are high-confidence with strong consensus across sources.

The primary differentiator is natural language element targeting: users say "the pricing section" instead of writing CSS selectors. The recommended architecture achieves this by having an `inspect_page` tool return a curated DOM summary to Claude, which then reasons about the correct selector -- leveraging Claude's existing strength rather than building fragile NLP into the server. This approach is novel (no existing MCP screenshot tool does it) and architecturally clean. The secondary differentiator is interactive authentication, where a visible browser opens for manual login and the session is captured for subsequent headless captures.

The critical risks are all in Phase 1: zombie Chromium processes from inadequate cleanup, screenshot timing failures on pages that never reach true "network idle," and security exposure from navigating a real browser to arbitrary URLs. All three have well-documented prevention strategies. The key insight from pitfalls research is that process lifecycle management must be designed correctly from day one -- retrofitting cleanup into an existing browser manager is painful and error-prone. The architecture must use lazy browser initialization, `try/finally` on all browser operations, and PID-level process tracking.

## Key Findings

### Recommended Stack

The stack is TypeScript on Node.js 22 LTS, using Playwright 1.58.x for browser automation and the MCP TypeScript SDK v1.x for the server framework. Sharp handles image processing (specifically element padding, which Playwright lacks natively). Vitest for unit testing, Playwright Test for integration tests, tsx for development, tsup for production builds.

**Core technologies:**
- **Playwright 1.58.x**: Headless browser automation -- superior to Puppeteer (cross-browser, better auto-waiting, locator API, active community)
- **@modelcontextprotocol/sdk v1.x**: MCP server framework -- official SDK, stable, v2 is pre-alpha and not ready
- **TypeScript 5.x**: Primary language -- type safety for MCP tool schemas, SDK is TypeScript-first
- **sharp 0.34.x**: Image processing -- Playwright has no native element padding; sharp is the fastest Node.js image library
- **Zod 3.x**: Schema validation -- required peer dependency of MCP SDK, defines tool parameter contracts

**Critical version notes:**
- Use MCP SDK v1.x, NOT v2 (pre-alpha). Migration path is documented when v2 stabilizes.
- Use Zod v3 import path (`import { z } from 'zod'`) to match SDK v1.x expectations.
- Install only Chromium browser via Playwright (`npx playwright install chromium`), not the full browser suite.

### Expected Features

**Must have (table stakes):**
- Full-page and viewport screenshots
- Element-targeted screenshots via CSS selector
- PNG and JPEG output with quality control
- Custom viewport dimensions
- Wait for page load / network idle
- Custom output path/filename
- Transparent background support
- Device scale factor / HiDPI

**Should have (differentiators):**
- Natural language element targeting (primary differentiator -- no competitor does this)
- Configurable padding around elements (low complexity, high documentation value)
- Dark/light mode toggle
- Device emulation presets (Playwright ships 100+ device definitions)
- Interactive authentication flow (visible browser for login, session capture)
- CSS/JS injection and element hiding before capture
- Organized output by site/page with timestamps
- MCP server architecture with Claude Code skill orchestration

**Defer (v2+):**
- Batch/multi-URL captures (users can call tools multiple times initially)
- Lazy content preloading (medium complexity, most docs targets do not need it)
- Cookie/session token injection (power-user feature, ship interactive auth first)
- opencode compatibility (explicitly last per project constraints)

**Anti-features (never build):**
- Visual regression / diff comparison (Percy, BackstopJS own this)
- Cross-browser rendering (Chromium-only is the right constraint)
- Cloud/SaaS API (local-only is the value proposition)
- Image editing/annotation, video capture, PDF generation, scheduling

### Architecture Approach

The system is two layers: an MCP server process (stdio transport) that owns Chromium lifecycle and screenshot capture, and a Claude Code skill (SKILL.md) that teaches Claude to orchestrate the MCP tools via natural language. The MCP server exposes 5-7 coarse-grained, intent-based tools prefixed with `shotput_`. The server must be fully functional without the skill layer (for opencode compatibility and self-documenting tool descriptions).

**Major components:**
1. **MCP Tool Layer** -- 6 tools (`capture_screenshot`, `capture_element`, `inspect_page`, `login_interactive`, `manage_session`, `configure`) with Zod-validated input schemas
2. **Browser Manager** -- Singleton that lazily launches Chromium, manages browser contexts, handles session state, cleans up on shutdown
3. **Screenshot Pipeline** -- Navigate, wait (with graceful degradation), target element, capture, apply padding via sharp, save with structured naming
4. **Session Manager** -- Playwright storageState save/load, interactive login flow (headed browser), session persistence as JSON files
5. **Skill Layer** -- SKILL.md with frontmatter, DOM targeting strategy guide, example workflows

### Critical Pitfalls

1. **Zombie browser processes** -- Use `try/finally` on ALL browser operations, track Chrome PIDs, kill on SIGTERM/SIGINT/exit. Single-browser-instance with fresh contexts, not new browsers per request. Must be correct from Phase 1.
2. **Screenshot timing failures** -- No universal "page ready" signal. Default to `domcontentloaded` + `waitForNetworkIdle({ idleTime: 500 })`, fall back gracefully if networkidle times out. Expose `waitFor` and `delay` parameters for per-capture tuning.
3. **Security from arbitrary URL navigation** -- Never use `--no-sandbox`. Block internal network ranges (except localhost, which is a core use case). Do not expose DevTools Protocol port. Set hard navigation timeouts.
4. **MCP server lifecycle mismanagement** -- Lazy browser init (fast startup), error boundaries on every tool handler (one failure must not crash server), handle stdin close for graceful shutdown.
5. **Large screenshot file sizes** -- Default to JPEG quality 85, not PNG. Set max page height for full-page captures (16384px). Return file paths through MCP, not image data.

## Implications for Roadmap

Based on research, suggested phase structure:

### Phase 1: Core Capture Engine + MCP Server Foundation
**Rationale:** Everything depends on the browser manager and capture pipeline. Architecture and PITFALLS research both identify this as the critical foundation -- process lifecycle, wait strategies, and security must be correct from day one.
**Delivers:** Working MCP server that captures full-page and viewport screenshots via `shotput_capture_screenshot`. Robust browser lifecycle with lazy init, proper cleanup, and signal handling. Basic output organization.
**Addresses:** Full-page screenshot, viewport screenshot, PNG/JPEG output, quality control, custom viewport dimensions, wait strategies, custom output path, transparent background, device scale factor.
**Avoids:** Zombie processes (PID tracking + try/finally), timing failures (graceful wait degradation), security exposure (sandbox enforcement, URL validation), lifecycle crashes (error boundaries, signal handlers).

### Phase 2: DOM Inspection + Element Targeting
**Rationale:** Element targeting is the primary differentiator and depends on the capture pipeline from Phase 1. The `inspect_page` tool returns a curated DOM summary; Claude identifies selectors. This is the architectural innovation.
**Delivers:** `shotput_inspect_page` and `shotput_capture_element` tools. DOM summary extraction (IDs, headings, landmarks, aria labels, text matching). Element padding via sharp (bounding box expansion + page clip).
**Addresses:** Element-targeted screenshots, natural language element targeting (via inspect + Claude reasoning), configurable padding, CSS/JS injection, element hiding before capture.
**Avoids:** Context window bloat (DOM summary, not raw HTML), wrong element selection (inspect-then-capture pattern gives Claude verification opportunity).

### Phase 3: Authentication + Session Management
**Rationale:** Auth is important but less common than basic screenshots. Needs Browser Manager from Phase 1 for context management. Security-sensitive -- must be designed carefully.
**Delivers:** `shotput_login_interactive` and `shotput_manage_session` tools. Interactive login flow (visible browser, storageState capture). Session persistence and reuse across captures.
**Addresses:** Interactive auth flow, session persistence, authenticated page captures.
**Avoids:** Session token leakage (incognito contexts, temp profiles, token scrubbing), cookie persistence on disk (session timeout, explicit cleanup).

### Phase 4: Skill Layer + Configuration + Polish
**Rationale:** The skill requires all tools to exist before it can reference them. Configuration and output naming refinement are non-blocking polish items.
**Delivers:** SKILL.md with frontmatter and allowed-tools. DOM targeting strategy reference doc. Example workflows. `shotput_configure` tool for defaults. Dark/light mode toggle. Device emulation presets. Refined output naming (domain/slug/timestamp).
**Addresses:** Claude Code skill orchestration, dark mode toggle, device presets, organized output, configuration defaults.
**Avoids:** Skill bloat (keep SKILL.md under 500 lines, use reference files).

### Phase 5: opencode Compatibility + Documentation
**Rationale:** Per project constraints, opencode support is explicitly last. Core must work in Claude Code first. Tool descriptions must be self-documenting (already enforced by architecture decisions).
**Delivers:** opencode configuration docs. Tool description refinement for non-skill environments. End-to-end testing in opencode. Public documentation.
**Addresses:** opencode compatibility, cross-client tool discoverability.

### Phase Ordering Rationale

- **Phase 1 before everything:** Browser Manager is a dependency for all subsequent phases. PITFALLS research is emphatic that process lifecycle must be correct from day one.
- **Phase 2 before Phase 3:** Element targeting is the primary differentiator and more commonly used than auth. It also validates the DOM summary architecture before adding auth complexity.
- **Phase 3 before Phase 4:** The skill layer needs to reference auth tools. Auth is also the last major tool to implement.
- **Phase 4 before Phase 5:** The skill is Claude Code-specific. opencode compatibility comes after the full feature set is working.
- **Feature grouping follows architectural boundaries:** Each phase maps to a distinct component (Browser Manager, Screenshot Pipeline, Session Manager, Skill Layer) rather than mixing concerns.

### Research Flags

Phases likely needing deeper research during planning:
- **Phase 2 (DOM Inspection):** The DOM summary extraction strategy -- what to include, size limits, how to handle SPAs with dynamic content -- needs prototyping. The approach is sound but the exact output format will need iteration.
- **Phase 3 (Authentication):** Interactive login flow UX (when to open browser, timeout behavior, error handling for expired sessions) is underspecified. Security review of session storage format needed.

Phases with standard patterns (skip research-phase):
- **Phase 1 (Core Capture):** Playwright screenshot API, MCP server setup, and browser lifecycle management are all well-documented with established patterns.
- **Phase 4 (Skill Layer):** Claude Code skills documentation is clear and the skill is pure Markdown with no code complexity.
- **Phase 5 (opencode):** Standard MCP compatibility testing, primarily documentation work.

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | All recommendations backed by official docs, version-specific npm data, and multiple comparison sources. Playwright vs Puppeteer decision is clear-cut. MCP SDK version guidance is from the official repo. |
| Features | HIGH | Comprehensive competitive analysis against capture-website, shot-scraper, pageres, BackstopJS. Clear table stakes vs differentiator separation. Anti-features well-justified. |
| Architecture | HIGH | MCP best practices from official sources (Phil Schmid, Block engineering blog). Playwright API for storageState, contexts, and screenshot options verified against docs. Coarse-grained tool design is consensus. |
| Pitfalls | HIGH | All critical pitfalls backed by specific GitHub issues with reproduction cases. Security pitfalls reference real CVEs. Prevention strategies are concrete and actionable. |

**Overall confidence:** HIGH

### Gaps to Address

- **DOM summary format:** The exact structure and size limits for `inspect_page` output need prototyping. Research identifies the approach (curated summary over raw HTML) but the implementation details require experimentation during Phase 2 planning.
- **tsup + Playwright native bindings:** STACK research flags MEDIUM confidence that tsup handles Playwright's native bindings correctly during bundling. May need to mark Playwright as external in the tsup config. Verify during Phase 1 build setup.
- **Zod v3 vs v4 import path:** The SDK v1.x uses Zod as a peer dependency. Current Zod npm has both v3 and v4 import paths. Confirm the correct import path against the specific SDK version during Phase 1 setup.
- **Interactive login timeout behavior:** What happens when a user opens a visible browser for login but never completes it? The 5-minute timeout is suggested but UX details need design during Phase 3.
- **MCP response size limits:** Returning file paths vs image data through MCP. Need to confirm if there are practical size limits on MCP tool responses that would affect returning base64-encoded screenshots.

## Sources

### Primary (HIGH confidence)
- [Playwright docs](https://playwright.dev/docs/screenshots) -- Screenshot API, contexts, storageState, device emulation
- [MCP TypeScript SDK](https://github.com/modelcontextprotocol/typescript-sdk) -- Server setup, tool registration, v1.x stability
- [MCP Lifecycle spec](https://modelcontextprotocol.io/specification/2025-03-26/basic/lifecycle) -- Server lifecycle, shutdown handling
- [Claude Code skills docs](https://code.claude.com/docs/en/skills) -- SKILL.md structure, allowed-tools, frontmatter
- [Playwright padding issue #16928](https://github.com/microsoft/playwright/issues/16928) -- Confirms no native padding, justifies sharp dependency

### Secondary (MEDIUM confidence)
- [MCP Best Practices - Phil Schmid](https://www.philschmid.de/mcp-best-practices) -- Coarse-grained tool design, 5-15 tools per server
- [Block's MCP Playbook](https://engineering.block.xyz/blog/blocks-playbook-for-designing-mcp-servers) -- Service-prefixed naming, outcome-oriented tools
- [BrowserStack Playwright vs Puppeteer](https://www.browserstack.com/guide/playwright-vs-puppeteer) -- Comparison data
- [Puppeteer zombie process issues](https://github.com/puppeteer/puppeteer/issues/5279) -- Process cleanup patterns
- [SSRF via headless browsers](https://httpvoid.com/Circumventing-Browser-Security-Mechanisms-For-SSRF.md) -- Security mitigation strategies

### Tertiary (LOW confidence)
- [WebMCP W3C Standard](https://webmcp.link/) -- Early preview, Chrome Canary only. Future opportunity, not a dependency.

---
*Research completed: 2026-03-07*
*Ready for roadmap: yes*
