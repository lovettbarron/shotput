# Phase 1: Core Capture Engine - Context

**Gathered:** 2026-03-07
**Status:** Ready for planning

<domain>
## Phase Boundary

MCP server with full-page and viewport screenshot capture of any URL, format/quality control (PNG/JPEG), configurable viewport dimensions and device scale factor, robust browser lifecycle management, and basic output to user-specified or default paths. Element targeting, authentication, skill layer, and batch captures are separate phases.

</domain>

<decisions>
## Implementation Decisions

### Wait Strategies
- Default wait strategy: network idle (Playwright's `networkidle`)
- Users can override per-capture with a `wait` parameter accepting: `networkidle`, `domcontentloaded`, `load`, or a number (fixed delay in ms)
- Auto-scroll enabled by default for full-page captures to trigger lazy-loaded content (CAPT-05); can be disabled with a flag
- Timeout behavior: 30s default timeout; if exceeded, capture whatever is loaded and return the screenshot with a warning — don't fail

### Output Defaults
- Default output directory: current working directory (cwd)
- Default filename format: `{domain}_{timestamp}.png` (e.g., `example-com_2026-03-07_14-30-45.png`) — human-readable, sortable, unique
- MCP response includes both the saved file path AND the image as base64 inline, so Claude can see the screenshot immediately
- File collision: overwrite silently when user specifies an explicit filename that already exists

### MCP Tool Interface
- Single tool: `shotput_capture` — full-page vs viewport controlled by a `fullPage` boolean param (default: false = viewport only)
- Only `url` is required; all other params (format, quality, viewport width/height, scale, fullPage, outputDir, filename, wait) have sensible defaults
- Default format: PNG (lossless)
- Tool naming convention: `shotput_` prefix for namespace (leaves room for `shotput_inspect`, `shotput_auth`, etc.)

### Browser Lifecycle
- Persistent browser: launch Playwright Chromium once, reuse across all captures in the MCP server session
- State isolation: new browser context per capture (clean cookies, storage, cache) — fast + isolated
- Per-capture timeout: 30s default (configurable), kills only that context on timeout; browser stays alive for subsequent captures
- Zombie prevention: register SIGINT/SIGTERM handlers for graceful browser shutdown, plus periodic health check to detect orphaned Chromium processes

### Claude's Discretion
- Exact auto-scroll implementation (scroll step size, delay between scrolls)
- Health check frequency and mechanism for orphaned process detection
- Internal code structure and module organization
- Error message wording and formatting

</decisions>

<specifics>
## Specific Ideas

No specific requirements — open to standard approaches

</specifics>

<code_context>
## Existing Code Insights

### Reusable Assets
- None — greenfield project, no existing code

### Established Patterns
- Playwright chosen over Puppeteer (research decision)
- MCP SDK v1.x (not v2 pre-alpha)
- tsup for bundling (Playwright may need to be marked as external)
- Zod for schema validation (confirm v3 vs v4 import path against MCP SDK v1.x)

### Integration Points
- MCP server uses stdio transport (ARCH-01)
- MIT license required from day one (QUAL-03)

</code_context>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 01-core-capture-engine*
*Context gathered: 2026-03-07*
