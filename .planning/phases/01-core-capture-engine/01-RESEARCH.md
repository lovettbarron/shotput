# Phase 1: Core Capture Engine - Research

**Researched:** 2026-03-07
**Domain:** MCP server with Playwright-based screenshot capture
**Confidence:** HIGH

## Summary

Phase 1 builds a greenfield MCP server that exposes a single `shotput_capture` tool for full-page and viewport screenshots. The stack is well-established: `@modelcontextprotocol/sdk` v1.27.x for the MCP server, Playwright v1.58.x for headless Chromium, Zod v3.25+ for schema validation (must stay on v3 -- v4 breaks MCP SDK), and tsup for bundling (Playwright must be marked external).

The primary technical challenges are: (1) auto-scrolling to trigger lazy-loaded content before full-page capture, since Playwright's `fullPage` option alone does not trigger lazy loads; (2) returning screenshots as both files and inline base64 in MCP responses, with a 1MB limit on inline content in some clients; and (3) robust browser lifecycle management with signal handlers and context-per-capture isolation.

**Primary recommendation:** Use `playwright` (not `playwright-core`) to include bundled Chromium, `@modelcontextprotocol/sdk` v1.27.x with `zod@^3.25`, and tsup with Playwright marked as `external`. Structure as a single MCP tool with sensible defaults per CONTEXT.md decisions.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- Default wait strategy: network idle (Playwright's `networkidle`)
- Users can override per-capture with a `wait` parameter accepting: `networkidle`, `domcontentloaded`, `load`, or a number (fixed delay in ms)
- Auto-scroll enabled by default for full-page captures to trigger lazy-loaded content (CAPT-05); can be disabled with a flag
- Timeout behavior: 30s default timeout; if exceeded, capture whatever is loaded and return the screenshot with a warning -- don't fail
- Default output directory: current working directory (cwd)
- Default filename format: `{domain}_{timestamp}.png` (e.g., `example-com_2026-03-07_14-30-45.png`) -- human-readable, sortable, unique
- MCP response includes both the saved file path AND the image as base64 inline, so Claude can see the screenshot immediately
- File collision: overwrite silently when user specifies an explicit filename that already exists
- Single tool: `shotput_capture` -- full-page vs viewport controlled by a `fullPage` boolean param (default: false = viewport only)
- Only `url` is required; all other params (format, quality, viewport width/height, scale, fullPage, outputDir, filename, wait) have sensible defaults
- Default format: PNG (lossless)
- Tool naming convention: `shotput_` prefix for namespace
- Persistent browser: launch Playwright Chromium once, reuse across all captures in the MCP server session
- State isolation: new browser context per capture (clean cookies, storage, cache)
- Per-capture timeout: 30s default (configurable), kills only that context on timeout; browser stays alive
- Zombie prevention: register SIGINT/SIGTERM handlers for graceful browser shutdown, plus periodic health check to detect orphaned Chromium processes
- Playwright chosen over Puppeteer (research decision)
- MCP SDK v1.x (not v2 pre-alpha)
- tsup for bundling (Playwright marked as external)
- Zod for schema validation -- must use v3.25+ (not v4) for MCP SDK v1.x compatibility
- MCP server uses stdio transport (ARCH-01)
- MIT license required from day one (QUAL-03)

### Claude's Discretion
- Exact auto-scroll implementation (scroll step size, delay between scrolls)
- Health check frequency and mechanism for orphaned process detection
- Internal code structure and module organization
- Error message wording and formatting

### Deferred Ideas (OUT OF SCOPE)
None -- discussion stayed within phase scope
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| CAPT-01 | Full-page screenshot of any URL | Playwright `page.screenshot({ fullPage: true })` + auto-scroll for lazy content |
| CAPT-02 | Viewport-only screenshot at specified dimensions | Playwright `page.screenshot()` with `browser.newContext({ viewport })` |
| CAPT-03 | Save as PNG or JPEG format | Playwright `type` option: `'png'` or `'jpeg'` |
| CAPT-04 | Control JPEG compression quality (0-100) | Playwright `quality` option (0-100, JPEG only) |
| CAPT-05 | Auto-scroll to trigger lazy-loaded content | Custom scroll implementation via `page.evaluate()` before screenshot |
| CAPT-06 | Wait for page load with configurable strategies | Playwright `waitUntil` / `waitForLoadState` with `networkidle`, `domcontentloaded`, `load`, or fixed delay |
| VIEW-01 | Custom viewport width and height | `browser.newContext({ viewport: { width, height } })` |
| VIEW-02 | Device scale factor (1x, 2x, 3x) | `browser.newContext({ deviceScaleFactor })` |
| ARCH-01 | MCP server with stdio transport | `McpServer` + `StdioServerTransport` from `@modelcontextprotocol/sdk` |
| ARCH-02 | Browser lifecycle management, no zombies | Persistent browser + context-per-capture + SIGINT/SIGTERM handlers |
| OUTP-01 | Custom output directory | Tool param `outputDir`, default to cwd, `fs.mkdir` with recursive |
| OUTP-02 | Custom filename | Tool param `filename`, default to `{domain}_{timestamp}.{ext}` pattern |
| QUAL-03 | MIT license | Create LICENSE file with MIT text |
| QUAL-04 | All deps MIT-compatible | Use `license-checker` to audit; Playwright=Apache-2.0, MCP SDK=MIT, Zod=MIT |
| QUAL-05 | No bundled fonts/assets with restrictive licenses | Verify no such assets are included; Playwright's bundled Chromium is Apache-2.0 |
</phase_requirements>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `@modelcontextprotocol/sdk` | ^1.27.1 | MCP server framework | Official TypeScript SDK; stable v1.x line |
| `playwright` | ^1.58.2 | Headless Chromium screenshots | Full screenshot API, auto-downloads Chromium, Apache-2.0 license |
| `zod` | ^3.25.0 | Schema validation for MCP tool params | Required peer dep of MCP SDK; must be v3 not v4 |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `tsup` | ^8.x | TypeScript bundling | Build step; bundle src to dist |
| `typescript` | ^5.x | Type checking | Dev dependency |
| `@types/node` | ^22.x | Node.js type defs | Dev dependency |
| `license-checker` | ^25.x | License audit | Dev dependency; run during CI/build to verify QUAL-04 |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `playwright` (full) | `playwright-core` | `playwright-core` does not bundle Chromium -- user must install separately. Use full `playwright` for zero-config experience |
| `zod` v4 | `zod` v3.25 | v4 has breaking API changes that cause `w._parse is not a function` errors with MCP SDK v1.x. MUST use v3 |

**Installation:**
```bash
npm install @modelcontextprotocol/sdk playwright zod
npm install -D tsup typescript @types/node license-checker
```

**Post-install:** Playwright auto-downloads Chromium. If CI needs explicit install: `npx playwright install chromium`

## Architecture Patterns

### Recommended Project Structure
```
src/
  index.ts           # Entry point: create server, connect transport
  server.ts          # McpServer setup, tool registration
  capture.ts         # Core screenshot capture logic
  browser.ts         # Browser lifecycle (launch, reuse, cleanup)
  scroll.ts          # Auto-scroll implementation for lazy content
  output.ts          # File naming, path resolution, directory creation
  types.ts           # Shared TypeScript types/interfaces
```

### Pattern 1: MCP Server with Tool Registration
**What:** Create an McpServer, register the `shotput_capture` tool with Zod schema, connect via stdio.
**When to use:** Always -- this is the MCP server entry point.
**Example:**
```typescript
// Source: MCP SDK official docs
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

const server = new McpServer({
  name: "shotput",
  version: "0.1.0",
});

server.tool(
  "shotput_capture",
  "Capture a screenshot of a web page",
  {
    url: z.string().url().describe("URL to capture"),
    fullPage: z.boolean().default(false).describe("Capture full scrollable page"),
    format: z.enum(["png", "jpeg"]).default("png").describe("Image format"),
    quality: z.number().min(0).max(100).optional().describe("JPEG quality (0-100)"),
    width: z.number().int().positive().default(1280).describe("Viewport width"),
    height: z.number().int().positive().default(720).describe("Viewport height"),
    scale: z.number().min(1).max(3).default(1).describe("Device scale factor"),
    outputDir: z.string().optional().describe("Output directory (default: cwd)"),
    filename: z.string().optional().describe("Output filename"),
    wait: z.union([
      z.enum(["networkidle", "domcontentloaded", "load"]),
      z.number().positive(),
    ]).default("networkidle").describe("Wait strategy"),
    autoScroll: z.boolean().default(true).describe("Auto-scroll for lazy content (full-page only)"),
    timeout: z.number().positive().default(30000).describe("Timeout in ms"),
  },
  async (params) => {
    // Implementation calls capture logic
    const result = await captureScreenshot(params);
    return {
      content: [
        { type: "text", text: `Screenshot saved to: ${result.filePath}` },
        { type: "image", data: result.base64, mimeType: `image/${params.format}` },
      ],
    };
  }
);

const transport = new StdioServerTransport();
await server.connect(transport);
```

### Pattern 2: Persistent Browser with Context-per-Capture
**What:** Launch browser once on first capture, create a fresh BrowserContext for each capture, close context after.
**When to use:** Every capture -- provides isolation without browser restart overhead.
**Example:**
```typescript
// Source: Playwright official docs
import { chromium, Browser, BrowserContext } from "playwright";

let browser: Browser | null = null;

async function getBrowser(): Promise<Browser> {
  if (!browser || !browser.isConnected()) {
    browser = await chromium.launch({ headless: true });
  }
  return browser;
}

async function captureWithContext(params: CaptureParams): Promise<Buffer> {
  const b = await getBrowser();
  const context: BrowserContext = await b.newContext({
    viewport: { width: params.width, height: params.height },
    deviceScaleFactor: params.scale,
  });

  try {
    const page = await context.newPage();
    await page.goto(params.url, {
      waitUntil: typeof params.wait === "string" ? params.wait : "load",
      timeout: params.timeout,
    });

    if (typeof params.wait === "number") {
      await page.waitForTimeout(params.wait);
    }

    if (params.fullPage && params.autoScroll) {
      await autoScroll(page);
    }

    const buffer = await page.screenshot({
      fullPage: params.fullPage,
      type: params.format,
      quality: params.format === "jpeg" ? params.quality : undefined,
    });

    return buffer;
  } finally {
    await context.close();
  }
}
```

### Pattern 3: Graceful Shutdown with Signal Handlers
**What:** Register process signal handlers to close browser on exit.
**When to use:** Always -- prevents zombie Chromium processes.
**Example:**
```typescript
function registerCleanup(browser: Browser): void {
  const cleanup = async () => {
    if (browser?.isConnected()) {
      await browser.close();
    }
    process.exit(0);
  };

  process.on("SIGINT", cleanup);
  process.on("SIGTERM", cleanup);
  process.on("exit", () => {
    // Synchronous fallback -- browser.close() is async,
    // so this is a last resort. The signal handlers above
    // handle the graceful case.
  });
}
```

### Pattern 4: Auto-Scroll for Lazy Content
**What:** Scroll page incrementally to trigger lazy-loaded images/content before full-page screenshot.
**When to use:** When `fullPage: true` and `autoScroll: true`.
**Example:**
```typescript
// Source: Playwright community pattern for lazy-load handling
async function autoScroll(page: Page): Promise<void> {
  await page.evaluate(async () => {
    await new Promise<void>((resolve) => {
      const scrollStep = 250;    // px per scroll
      const scrollDelay = 100;   // ms between scrolls
      let totalScrolled = 0;
      const maxScroll = document.body.scrollHeight;

      const timer = setInterval(() => {
        window.scrollBy(0, scrollStep);
        totalScrolled += scrollStep;

        if (totalScrolled >= maxScroll) {
          clearInterval(timer);
          window.scrollTo(0, 0); // Reset to top before capture
          resolve();
        }
      }, scrollDelay);
    });
  });

  // Wait for any images triggered by scrolling to finish loading
  await page.waitForLoadState("networkidle").catch(() => {
    // networkidle may timeout -- that's okay, continue with capture
  });
}
```

### Anti-Patterns to Avoid
- **Launching browser per capture:** Each `chromium.launch()` takes 1-3 seconds. Reuse a single browser instance across the MCP session.
- **Using `playwright-core` without bundled browser:** Forces users to install Chromium manually. Use the full `playwright` package.
- **Importing Zod v4:** Causes runtime crashes with MCP SDK v1.x. Pin to `zod@^3.25`.
- **Writing to stdout for logging:** MCP stdio transport uses stdout for protocol messages. All logging MUST go to stderr.
- **Synchronous cleanup on exit:** `browser.close()` is async. Use signal handlers (SIGINT/SIGTERM) for graceful shutdown, not the `exit` event.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| MCP protocol handling | Custom JSON-RPC over stdio | `@modelcontextprotocol/sdk` McpServer + StdioServerTransport | Protocol is complex with capability negotiation, progress, cancellation |
| Browser automation | Puppeteer or CDP direct | Playwright | Better API, auto-waits, bundled browsers, maintained by Microsoft |
| Schema validation | Manual param parsing | Zod schemas via MCP SDK `server.tool()` | MCP SDK integrates Zod natively; auto-generates JSON Schema for clients |
| License auditing | Manual package.json scanning | `license-checker --onlyAllow` | Handles transitive deps, SPDX expressions, edge cases |
| File path sanitization | Custom regex | `path.resolve()` + `path.join()` | OS-aware path handling, prevents traversal |

**Key insight:** The MCP SDK and Playwright handle the two hardest parts (protocol + browser). Focus implementation effort on the glue: auto-scroll, output naming, and lifecycle management.

## Common Pitfalls

### Pitfall 1: Zod v4 Incompatibility
**What goes wrong:** Installing `zod@latest` (v4.x) causes `w._parse is not a function` runtime errors when MCP SDK tries to convert schemas.
**Why it happens:** MCP SDK v1.x internally uses Zod v3 APIs. Zod v4 changed internal structure.
**How to avoid:** Pin `zod@^3.25` in package.json. Add a comment explaining why.
**Warning signs:** Any `_parse` errors at runtime.

### Pitfall 2: stdout Pollution Breaks MCP
**What goes wrong:** `console.log()` writes to stdout, corrupting the MCP JSON-RPC stream. Server becomes unresponsive.
**Why it happens:** MCP stdio transport uses stdout exclusively for protocol messages.
**How to avoid:** Use `console.error()` for all logging, or better, use the MCP SDK's built-in logging facilities (`server.sendLoggingMessage()`).
**Warning signs:** MCP client reports "invalid JSON" or connection drops.

### Pitfall 3: Full-Page Screenshots Miss Lazy Content
**What goes wrong:** `fullPage: true` captures the page dimensions but images loaded via `loading="lazy"` or intersection observers appear as blank placeholders.
**Why it happens:** Playwright measures page height and stitches, but doesn't scroll to trigger lazy observers.
**How to avoid:** Auto-scroll the page before taking the screenshot (Pattern 4 above).
**Warning signs:** Screenshots with grey/blank image placeholders.

### Pitfall 4: networkidle Hangs on SPAs
**What goes wrong:** `waitUntil: 'networkidle'` never resolves because the page makes continuous polling/analytics requests.
**Why it happens:** networkidle requires 500ms of zero network connections; SPAs often have persistent connections.
**How to avoid:** Wrap networkidle wait in a timeout. Per user decision: on timeout, capture whatever is loaded and return with a warning.
**Warning signs:** Captures hanging indefinitely or timing out.

### Pitfall 5: tsup Bundles Playwright
**What goes wrong:** tsup tries to bundle Playwright's native bindings and browser launcher, causing build errors or runtime failures.
**Why it happens:** Playwright uses native Node.js modules and spawns external browser processes.
**How to avoid:** Mark `playwright` as external in tsup config: `external: ['playwright']`.
**Warning signs:** Build errors about missing binaries, or bundled output that can't find Chromium.

### Pitfall 6: MCP Image Content Size Limit
**What goes wrong:** Large screenshots (high-DPI, full-page) exceed the 1MB inline content limit in some MCP clients like Claude Desktop.
**Why it happens:** Base64 encoding increases data size by ~33%. A 2x scale full-page screenshot can easily exceed 1MB.
**How to avoid:** Always save to file (primary). Return base64 inline as a best-effort -- if buffer exceeds ~750KB, return only the file path with a note that the image is too large for inline display.
**Warning signs:** MCP client silently drops image content or errors.

### Pitfall 7: Zombie Chromium on Crash
**What goes wrong:** If the Node.js process crashes (unhandled exception, OOM), Chromium processes remain running.
**Why it happens:** Signal handlers and cleanup code don't execute on hard crashes.
**How to avoid:** Register signal handlers for SIGINT/SIGTERM (covers graceful shutdown). For hard crashes, implement a periodic health check or use `process.on('uncaughtException')` as a last-resort cleanup.
**Warning signs:** `ps aux | grep chromium` showing orphaned processes after server stops.

## Code Examples

### tsup Configuration
```typescript
// tsup.config.ts
import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/index.ts"],
  format: ["esm"],
  target: "node22",
  outDir: "dist",
  clean: true,
  sourcemap: true,
  external: ["playwright"],
  dts: false, // Not a library -- no type declarations needed
});
```

### package.json Key Fields
```json
{
  "name": "shotput",
  "version": "0.1.0",
  "license": "MIT",
  "type": "module",
  "bin": {
    "shotput": "./dist/index.js"
  },
  "scripts": {
    "build": "tsup",
    "start": "node dist/index.js",
    "dev": "tsup --watch",
    "license-check": "license-checker --onlyAllow 'MIT;Apache-2.0;ISC;BSD-2-Clause;BSD-3-Clause;0BSD;CC0-1.0;Unlicense'"
  },
  "dependencies": {
    "@modelcontextprotocol/sdk": "^1.27.1",
    "playwright": "^1.58.2",
    "zod": "^3.25.0"
  },
  "devDependencies": {
    "@types/node": "^22.0.0",
    "tsup": "^8.0.0",
    "typescript": "^5.0.0",
    "license-checker": "^25.0.0"
  }
}
```

### Output File Naming
```typescript
// Source: User decision from CONTEXT.md
import path from "node:path";

function generateFilename(url: string, format: "png" | "jpeg"): string {
  const parsed = new URL(url);
  const domain = parsed.hostname.replace(/\./g, "-");
  const now = new Date();
  const timestamp = now.toISOString()
    .replace(/T/, "_")
    .replace(/:/g, "-")
    .replace(/\..+/, "");
  const ext = format === "jpeg" ? "jpg" : "png";
  return `${domain}_${timestamp}.${ext}`;
}

function resolveOutputPath(
  outputDir: string | undefined,
  filename: string | undefined,
  url: string,
  format: "png" | "jpeg"
): string {
  const dir = outputDir || process.cwd();
  const name = filename || generateFilename(url, format);
  return path.resolve(dir, name);
}
```

### MCP Tool Response with Image
```typescript
// Source: MCP SDK docs + community patterns
function buildResponse(
  filePath: string,
  buffer: Buffer,
  format: "png" | "jpeg",
  warning?: string
): { content: Array<{ type: string; text?: string; data?: string; mimeType?: string }> } {
  const content: Array<{ type: string; text?: string; data?: string; mimeType?: string }> = [];

  if (warning) {
    content.push({ type: "text", text: `Warning: ${warning}` });
  }

  content.push({ type: "text", text: `Screenshot saved to: ${filePath}` });

  // Only include inline image if under ~750KB to avoid client limits
  const MAX_INLINE_SIZE = 750 * 1024;
  if (buffer.length <= MAX_INLINE_SIZE) {
    content.push({
      type: "image",
      data: buffer.toString("base64"),
      mimeType: `image/${format === "jpeg" ? "jpeg" : "png"}`,
    });
  } else {
    content.push({
      type: "text",
      text: "Image too large for inline display. View the saved file.",
    });
  }

  return { content };
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Puppeteer for screenshots | Playwright | 2020+ | Better API, auto-waits, bundled browsers |
| MCP SDK v0.x | MCP SDK v1.27.x | 2025 | Stable API, McpServer class, tool() helper |
| Zod v3 | Zod v3.25+ (v4 exists but incompatible) | 2025 | Must pin v3 for MCP SDK v1.x compat |
| Custom JSON-RPC | StdioServerTransport | 2025 | SDK handles protocol, framing, error handling |
| `waitUntil: 'networkidle'` as best practice | Web assertions / explicit waits | 2024+ | Playwright discourages networkidle; but user locked this as default |

**Deprecated/outdated:**
- `playwright-core` alone (without browser bundle): Still works but requires manual browser install
- Zod v4 with MCP SDK v1.x: Breaks at runtime. Wait for MCP SDK v2 (expected Q1 2026) for v4 support

## Open Questions

1. **networkidle as default vs Playwright recommendation**
   - What we know: Playwright discourages `networkidle` because SPAs may never become idle. User locked `networkidle` as default.
   - What's unclear: Whether the 30s timeout adequately mitigates hangs in practice.
   - Recommendation: Implement as decided (networkidle default with 30s timeout). The timeout + "capture whatever is loaded" fallback handles the SPA case. Log a warning via stderr when timeout triggers.

2. **MCP inline image size limits**
   - What we know: Claude Desktop enforces a 1MB limit. Other MCP clients may differ.
   - What's unclear: Exact limits for Claude Code and other clients.
   - Recommendation: Use 750KB as a conservative threshold. Always save to file as primary output. Inline is best-effort.

3. **Periodic health check for orphaned Chromium**
   - What we know: SIGINT/SIGTERM handlers cover graceful shutdown. Hard crashes leave zombies.
   - What's unclear: Best mechanism -- periodic `ps` check? Chromium PID tracking?
   - Recommendation: Track Chromium PID from `browser.process().pid`. On `uncaughtException`, kill that PID. Periodic checks add complexity for marginal benefit -- defer to Phase 5 hardening if needed.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | vitest (latest stable) |
| Config file | `vitest.config.ts` -- Wave 0 |
| Quick run command | `npx vitest run --reporter=verbose` |
| Full suite command | `npx vitest run --reporter=verbose` |

### Phase Requirements -> Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| CAPT-01 | Full-page screenshot of URL | integration | `npx vitest run tests/capture.test.ts -t "full page"` | -- Wave 0 |
| CAPT-02 | Viewport-only screenshot | integration | `npx vitest run tests/capture.test.ts -t "viewport"` | -- Wave 0 |
| CAPT-03 | PNG and JPEG format output | unit | `npx vitest run tests/capture.test.ts -t "format"` | -- Wave 0 |
| CAPT-04 | JPEG quality control | unit | `npx vitest run tests/capture.test.ts -t "quality"` | -- Wave 0 |
| CAPT-05 | Auto-scroll triggers lazy content | integration | `npx vitest run tests/scroll.test.ts` | -- Wave 0 |
| CAPT-06 | Configurable wait strategies | integration | `npx vitest run tests/capture.test.ts -t "wait"` | -- Wave 0 |
| VIEW-01 | Custom viewport dimensions | integration | `npx vitest run tests/capture.test.ts -t "viewport dimensions"` | -- Wave 0 |
| VIEW-02 | Device scale factor | integration | `npx vitest run tests/capture.test.ts -t "scale"` | -- Wave 0 |
| ARCH-01 | MCP server stdio transport | integration | `npx vitest run tests/server.test.ts` | -- Wave 0 |
| ARCH-02 | Browser lifecycle, no zombies | integration | `npx vitest run tests/browser.test.ts` | -- Wave 0 |
| OUTP-01 | Custom output directory | unit | `npx vitest run tests/output.test.ts -t "directory"` | -- Wave 0 |
| OUTP-02 | Custom filename | unit | `npx vitest run tests/output.test.ts -t "filename"` | -- Wave 0 |
| QUAL-03 | MIT license file exists | smoke | `test -f LICENSE` | -- Wave 0 |
| QUAL-04 | Deps license compatible | smoke | `npx license-checker --onlyAllow 'MIT;Apache-2.0;ISC;BSD-2-Clause;BSD-3-Clause;0BSD;CC0-1.0;Unlicense'` | -- Wave 0 |
| QUAL-05 | No restrictive bundled assets | manual-only | Visual audit of dist/ output | N/A |

### Sampling Rate
- **Per task commit:** `npx vitest run --reporter=verbose` (quick)
- **Per wave merge:** `npx vitest run --reporter=verbose` (full suite)
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `vitest.config.ts` -- vitest configuration
- [ ] `tests/capture.test.ts` -- CAPT-01 through CAPT-06, VIEW-01, VIEW-02
- [ ] `tests/scroll.test.ts` -- CAPT-05 auto-scroll behavior
- [ ] `tests/server.test.ts` -- ARCH-01 MCP server integration
- [ ] `tests/browser.test.ts` -- ARCH-02 lifecycle/cleanup
- [ ] `tests/output.test.ts` -- OUTP-01, OUTP-02 file output
- [ ] Framework install: `npm install -D vitest`
- [ ] Test HTML fixtures: static HTML pages for predictable screenshot testing

## Sources

### Primary (HIGH confidence)
- [@modelcontextprotocol/sdk npm](https://www.npmjs.com/package/@modelcontextprotocol/sdk) - v1.27.1, peer deps, API
- [MCP TypeScript SDK GitHub](https://github.com/modelcontextprotocol/typescript-sdk) - server docs, tool definition API
- [Playwright Screenshots](https://playwright.dev/docs/screenshots) - screenshot API options
- [Playwright browser.newContext](https://playwright.dev/docs/api/class-browser#browser-new-context) - viewport, deviceScaleFactor
- [playwright npm](https://www.npmjs.com/package/playwright) - v1.58.2

### Secondary (MEDIUM confidence)
- [Zod v4 MCP incompatibility issue #1429](https://github.com/modelcontextprotocol/modelcontextprotocol/issues/1429) - confirmed v4 breaks v1.x
- [Zod re-export issue #802](https://github.com/modelcontextprotocol/typescript-sdk/issues/802) - import path guidance
- [Playwright lazy-load issue #19861](https://github.com/microsoft/playwright/issues/19861) - auto-scroll pattern
- [MCP image content discussion](https://github.com/orgs/modelcontextprotocol/discussions/199) - image return format
- [license-checker npm](https://www.npmjs.com/package/license-checker) - license auditing tool

### Tertiary (LOW confidence)
- MCP inline image 1MB limit -- reported in community discussions, not officially documented. Using conservative 750KB threshold.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- all libraries verified on npm with current versions
- Architecture: HIGH -- patterns from official docs and well-documented community usage
- Pitfalls: HIGH -- multiple sources confirm Zod v4 incompatibility, stdout pollution, lazy-load issues
- Validation: MEDIUM -- vitest is standard choice but no existing test infrastructure to verify against

**Research date:** 2026-03-07
**Valid until:** 2026-04-07 (30 days -- stable ecosystem, no major releases expected)
