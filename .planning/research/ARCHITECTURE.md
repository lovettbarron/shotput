# Architecture Patterns

**Domain:** Headless browser screenshot capture (MCP server + Claude Code skill)
**Researched:** 2026-03-07

## Recommended Architecture

Shotput is a two-layer system: an **MCP server** that owns Chromium lifecycle and screenshot capture, and a **Claude Code skill** that provides the natural language interface and orchestration logic. The MCP server runs as a local stdio process managed by Claude Code (or opencode). The skill teaches Claude how to compose MCP tool calls into workflows.

```
+--------------------------------------------------+
|  Claude Code / opencode                          |
|  +--------------------------------------------+  |
|  | Shotput Skill (SKILL.md)                   |  |
|  | - Natural language DOM targeting prompts    |  |
|  | - Workflow orchestration instructions       |  |
|  | - Output naming conventions                |  |
|  +--------------------------------------------+  |
|       | invokes MCP tools via stdio                |
+------|--------------------------------------------|
       v
+--------------------------------------------------+
|  Shotput MCP Server (TypeScript, stdio transport) |
|  +--------------------------------------------+  |
|  | Tool Layer (5-7 intent-based tools)        |  |
|  |  - shotput_capture_screenshot              |  |
|  |  - shotput_capture_element                 |  |
|  |  - shotput_inspect_page                    |  |
|  |  - shotput_login_interactive               |  |
|  |  - shotput_manage_session                  |  |
|  |  - shotput_configure                       |  |
|  +--------------------------------------------+  |
|  +--------------------------------------------+  |
|  | Browser Manager (singleton)                |  |
|  |  - Launches/reuses Chromium via Playwright |  |
|  |  - Manages browser contexts                |  |
|  |  - Handles session/storage state           |  |
|  |  - Cleanup on server shutdown              |  |
|  +--------------------------------------------+  |
|  +--------------------------------------------+  |
|  | Screenshot Pipeline                        |  |
|  |  - Navigate + wait strategies              |  |
|  |  - DOM query / element location            |  |
|  |  - Capture (full page / element / clip)    |  |
|  |  - Padding / cropping                      |  |
|  |  - File output + metadata                  |  |
|  +--------------------------------------------+  |
+--------------------------------------------------+
       |
       v
+--------------------------------------------------+
|  Playwright + Chromium                           |
|  - Headless and headed modes                     |
|  - Persistent contexts (userDataDir)             |
|  - Storage state (cookies, localStorage)         |
+--------------------------------------------------+
```

### Component Boundaries

| Component | Responsibility | Communicates With |
|-----------|---------------|-------------------|
| **Skill layer** (SKILL.md + supporting files) | Natural language instructions, workflow patterns, output conventions, DOM targeting strategy | Claude Code runtime (loaded as context); invokes MCP tools |
| **MCP Tool Layer** | Defines 5-7 coarse-grained tools with input schemas; validates inputs; returns structured results | Skill layer (via MCP protocol); Browser Manager (internal) |
| **Browser Manager** | Singleton that launches Chromium, manages browser/context lifecycle, caches contexts, handles cleanup | MCP Tool Layer (called by tools); Playwright API |
| **Screenshot Pipeline** | Navigation, waiting, element targeting, capture, padding, file output | Browser Manager (gets page/context); filesystem (writes output) |
| **Session Manager** | Stores/loads Playwright storageState files, manages interactive login flow | Browser Manager (provides contexts); filesystem (persists state) |

### Data Flow

**Standard screenshot capture:**
```
User says "take a screenshot of the pricing section on example.com"
  -> Claude Code loads Skill context
  -> Claude reasons: needs to inspect page first, then capture element
  -> Claude calls shotput_inspect_page(url: "https://example.com", description: "pricing section")
     -> MCP server navigates to URL
     -> Extracts page DOM structure (headings, sections, key elements)
     -> Returns: DOM summary with candidate selectors
  -> Claude identifies best selector from DOM context
  -> Claude calls shotput_capture_element(url: "https://example.com", selector: "#pricing", padding: 20)
     -> MCP server navigates (or reuses page if same URL)
     -> Waits for network idle + element visible
     -> Locates element, calculates bounding box + padding
     -> Captures screenshot
     -> Saves to output directory with structured name
     -> Returns: { path: "screenshots/example-com/pricing-20260307-143022.png", dimensions: {...} }
  -> Claude reports result to user
```

**Authenticated capture:**
```
User says "I need to screenshot my dashboard on app.example.com, I'll need to log in"
  -> Claude calls shotput_login_interactive(url: "https://app.example.com/login", session_name: "example-app")
     -> MCP server launches VISIBLE Chromium window
     -> Navigates to login URL
     -> Returns: { status: "browser_open", message: "Log in and confirm when done" }
  -> User logs in manually in the visible browser
  -> User confirms "I'm logged in"
  -> Claude calls shotput_manage_session(action: "save", session_name: "example-app")
     -> MCP server captures storageState from visible context
     -> Saves to .shotput/sessions/example-app.json
     -> Closes visible browser
     -> Returns: { status: "saved", session_name: "example-app" }
  -> Claude calls shotput_capture_screenshot(url: "https://app.example.com/dashboard", session: "example-app", ...)
     -> MCP server creates headless context with saved storageState
     -> Navigates and captures
     -> Returns screenshot path
```

## Component Deep Dives

### 1. MCP Server Structure

**Transport:** stdio (local process, compatible with Claude Code and opencode). No SSE/HTTP needed since Shotput is a local tool.

**Framework:** Use `@modelcontextprotocol/sdk` directly (not FastMCP). The official SDK is well-documented, stable, and avoids an unnecessary abstraction layer for a server with 5-7 tools.

**Project layout:**
```
src/
  index.ts              # MCP server entry point, tool registration
  tools/
    capture.ts          # shotput_capture_screenshot, shotput_capture_element
    inspect.ts          # shotput_inspect_page
    auth.ts             # shotput_login_interactive, shotput_manage_session
    configure.ts        # shotput_configure
  browser/
    manager.ts          # BrowserManager singleton
    navigation.ts       # URL navigation + wait strategies
    screenshot.ts       # Capture pipeline (element targeting, padding, output)
  session/
    storage.ts          # Playwright storageState save/load
    cookies.ts          # Cookie injection utilities
  output/
    naming.ts           # File naming conventions
    metadata.ts         # Screenshot metadata generation
  types.ts              # Shared TypeScript types
  config.ts             # Runtime configuration
```

### 2. MCP Tool Design (Coarse-Grained, Intent-Based)

Following MCP best practices: 5-7 tools designed around user intent, not API surface. Each tool bundles multiple internal operations into a single call.

| Tool | Purpose | Key Parameters |
|------|---------|---------------|
| `shotput_capture_screenshot` | Full-page or viewport screenshot | `url`, `fullPage?`, `viewport?`, `format?`, `quality?`, `colorScheme?`, `session?`, `outputDir?`, `filename?` |
| `shotput_capture_element` | Element-targeted screenshot with padding | `url`, `selector`, `padding?`, `viewport?`, `format?`, `colorScheme?`, `session?`, `outputDir?`, `filename?` |
| `shotput_inspect_page` | Extract DOM structure for Claude to identify selectors | `url`, `description?`, `session?` |
| `shotput_login_interactive` | Open visible browser for manual authentication | `url`, `session_name` |
| `shotput_manage_session` | Save, load, list, or delete session states | `action` (save/list/delete), `session_name?` |
| `shotput_configure` | Set defaults (output dir, viewport, format) | `outputDir?`, `defaultViewport?`, `defaultFormat?` |

**Why this granularity:**
- `capture_screenshot` and `capture_element` are separate because they have different parameter shapes and capture semantics. Merging them would create a confusing "if selector then element else fullpage" conditional tool.
- `inspect_page` is critical: it gives Claude the DOM context it needs to translate natural language descriptions into CSS selectors. Without this, Claude would be guessing selectors blindly.
- Auth tools are separate from capture tools because the interactive login flow is a multi-turn human-in-the-loop process, fundamentally different from automated capture.

**Tool naming:** Prefixed with `shotput_` to avoid collision when multiple MCP servers are active (per MCP best practices).

### 3. Browser Manager

**Design:** Singleton pattern within the MCP server process. One Chromium instance, multiple browser contexts.

```typescript
class BrowserManager {
  private browser: Browser | null = null;
  private contexts: Map<string, BrowserContext> = new Map();

  // Lazy launch - only starts Chromium when first tool is called
  async getBrowser(): Promise<Browser> { ... }

  // Get or create a context (optionally with saved session state)
  async getContext(options?: {
    session?: string;        // Load storageState from saved session
    colorScheme?: 'light' | 'dark';
    viewport?: { width: number; height: number };
  }): Promise<BrowserContext> { ... }

  // Launch visible browser for interactive login
  async launchVisible(url: string): Promise<{ context: BrowserContext; page: Page }> { ... }

  // Cleanup
  async closeContext(id: string): Promise<void> { ... }
  async shutdown(): Promise<void> { ... }
}
```

**Key decisions:**
- **Lazy launch:** Chromium is not started until the first tool call. This keeps MCP server startup fast.
- **Context reuse:** For repeated captures of the same site, reuse the browser context (same cookies, same session). Create a new context when session/viewport/colorScheme changes.
- **Headed vs headless:** Interactive login uses `headless: false`. All other operations use `headless: true` (or `headless: 'shell'` for Playwright's lighter headless mode).
- **Cleanup on shutdown:** Register process signal handlers (SIGTERM, SIGINT) and MCP server close handler to close all contexts and the browser.

### 4. DOM Targeting Pipeline (inspect_page)

This is the critical innovation. The user says "the pricing table" and Claude needs to find the right CSS selector.

**Strategy: Return DOM summary, let Claude reason about selectors.**

The `shotput_inspect_page` tool does NOT try to do AI-based element identification. Instead, it extracts a structured DOM summary and returns it to Claude, which already excels at reasoning about HTML structure.

```
inspect_page(url, description?) ->
  1. Navigate to URL, wait for load
  2. Extract DOM summary:
     - All elements with id attributes
     - All elements with meaningful class names
     - Heading hierarchy (h1-h6 with text content)
     - Landmark elements (nav, main, section, article, aside, footer)
     - Elements with aria-label or data-testid attributes
     - Form elements with labels
     - If description provided: elements whose text content matches
  3. Return structured summary (not raw HTML - too large)
```

**Why this approach over alternatives:**
- Sending full page HTML to Claude wastes context tokens and often exceeds limits
- Having the MCP server do its own NLP matching would be fragile and redundant (Claude IS the NLP)
- A curated DOM summary gives Claude enough signal to pick the right selector without context bloat
- The optional `description` parameter enables pre-filtering: if user said "pricing section", the tool can highlight elements containing "pricing" text

**Output format from inspect_page:**
```json
{
  "url": "https://example.com",
  "title": "Example - Pricing",
  "headings": [
    { "level": 1, "text": "Our Plans", "selector": "h1" },
    { "level": 2, "text": "Pricing", "selector": "#pricing h2" }
  ],
  "sections": [
    { "tag": "section", "id": "pricing", "classes": ["pricing-section"], "text_preview": "Choose your plan..." },
    { "tag": "section", "id": "features", "classes": ["features-grid"], "text_preview": "Why choose us..." }
  ],
  "landmarks": [...],
  "matching_elements": [
    { "selector": "#pricing", "tag": "section", "text_preview": "Choose your plan. Free: $0/mo..." }
  ]
}
```

### 5. Screenshot Pipeline

The capture pipeline handles the navigate-wait-target-capture-save sequence.

```
Input: url, selector?, options
  |
  v
[Navigate] -> page.goto(url, { waitUntil: 'networkidle' })
  |            Falls back to 'domcontentloaded' after timeout
  v
[Wait]     -> Wait for network idle (default)
  |            + If selector: waitForSelector(selector, { state: 'visible' })
  |            + Optional: additional delay for animations
  v
[Target]   -> If element capture:
  |              locator = page.locator(selector)
  |              Verify element exists and is visible
  |              Get bounding box for padding calculation
  v
[Capture]  -> Full page: page.screenshot({ fullPage: true })
  |            Element:   locator.screenshot() with padding via clip
  |            Apply format (png/jpeg), quality, omitBackground
  v
[Padding]  -> If element capture with padding:
  |              Expand bounding box by padding amount
  |              Clamp to viewport bounds
  |              Use page.screenshot({ clip: expandedBox })
  v
[Save]     -> Generate filename (see Output Organization)
  |            Write to output directory
  |            Generate metadata sidecar (optional)
  v
[Return]   -> { path, dimensions, format, size, timestamp }
```

**Wait strategy details:**
- Default: `networkidle` (no network requests for 500ms) with a 30-second timeout
- Fallback: If networkidle times out (common on sites with analytics/websockets), fall back to `domcontentloaded` + 2-second delay
- Element-specific: After page load, additionally wait for the target selector to be visible
- SPAs: For single-page apps, may need to wait for route transitions. The `networkidle` strategy handles most cases.

**Padding implementation:**
Playwright's `locator.screenshot()` captures exactly the element's bounding box. To add padding, use `page.screenshot({ clip: { x, y, width, height } })` with an expanded bounding box instead. Clamp coordinates to prevent going outside the viewport.

### 6. Session/Auth Management

**Storage mechanism:** Playwright's `storageState` API, which serializes cookies, localStorage, and optionally IndexedDB to a JSON file.

**Session file location:** `.shotput/sessions/<session-name>.json` in the project directory.

**Interactive login flow:**
1. `shotput_login_interactive` launches a **visible** (headed) Chromium instance using `chromium.launch({ headless: false })`
2. Navigates to the provided URL
3. Returns immediately with status "browser_open" - the user interacts with the real browser window
4. After user confirms login, `shotput_manage_session(action: "save")` captures `context.storageState()` and writes it to disk
5. The visible browser is closed
6. Subsequent `shotput_capture_*` calls with `session: "example-app"` create a headless context initialized with `browser.newContext({ storageState: ".shotput/sessions/example-app.json" })`

**Alternative: Direct cookie injection:**
For users who have session tokens (e.g., from browser devtools), support direct cookie injection via `shotput_manage_session(action: "inject", cookies: [...])`. This is a power-user flow.

**Session lifecycle:**
- Sessions persist across MCP server restarts (they're just JSON files)
- Sessions may expire (cookies expire). Failed auth on a saved session should produce a clear error suggesting re-login
- `shotput_manage_session(action: "list")` shows available sessions with last-used timestamps

### 7. Skill Layer Structure

The skill teaches Claude HOW to use Shotput tools effectively. It lives in the project repo at `.claude/skills/shotput/`.

```
.claude/skills/shotput/
  SKILL.md              # Main skill instructions
  references/
    dom-targeting.md    # Guide for translating descriptions to selectors
    examples.md         # Example workflows (full page, element, auth)
```

**SKILL.md content strategy:**

```yaml
---
name: shotput
description: >
  Capture screenshots of web pages and specific elements. Use when the user
  asks to screenshot, capture, or take a picture of a website, page, element,
  or component. Handles full-page captures, element targeting with natural
  language, authenticated pages, and device simulation.
allowed-tools: mcp__shotput__shotput_capture_screenshot, mcp__shotput__shotput_capture_element, mcp__shotput__shotput_inspect_page, mcp__shotput__shotput_login_interactive, mcp__shotput__shotput_manage_session, mcp__shotput__shotput_configure
---

# Shotput: Screenshot Capture

## Core Workflow

1. If user describes a specific element (not full page):
   - Call shotput_inspect_page first to get DOM structure
   - Identify the best CSS selector from the DOM summary
   - Call shotput_capture_element with that selector

2. If user wants full page:
   - Call shotput_capture_screenshot directly

3. If page requires authentication:
   - Check if session exists via shotput_manage_session(action: "list")
   - If no session: use shotput_login_interactive, then shotput_manage_session(action: "save")
   - Pass session name to capture tools

## DOM Targeting Strategy
[See references/dom-targeting.md for detailed guide]

When translating user descriptions to selectors:
- Prefer #id selectors (most stable)
- Use [data-testid] when available
- Use semantic selectors (section, article, nav) over div chains
- Use text-based selectors as last resort: text="Pricing"
...
```

**Key skill design decisions:**
- `allowed-tools` lists all Shotput MCP tools so Claude can call them without per-use approval
- The skill is auto-invocable (no `disable-model-invocation`) because it should activate whenever the user mentions screenshots
- DOM targeting strategy is in a reference file to keep SKILL.md under 500 lines
- The skill does NOT try to be a complete decision tree; it gives Claude principles and lets it reason

### 8. Output Organization

**Default structure:**
```
screenshots/                          # Default output root (configurable)
  <domain>/                           # Grouped by site domain
    <slug>-<timestamp>.<format>       # Human-readable name + timestamp
```

**Examples:**
```
screenshots/
  example-com/
    full-page-20260307-143022.png
    pricing-section-20260307-143045.png
  app-mysite-io/
    dashboard-20260307-150112.png
    settings-profile-20260307-150234.jpeg
```

**Naming rules:**
- Domain: URL hostname with dots replaced by hyphens
- Slug: derived from page title, element description, or user-provided name; kebab-case; max 50 chars
- Timestamp: YYYYMMDD-HHmmss format
- User can override any part via `filename` parameter

**Metadata (optional sidecar):**
```json
{
  "url": "https://example.com",
  "selector": "#pricing",
  "viewport": { "width": 1280, "height": 720 },
  "colorScheme": "light",
  "padding": 20,
  "timestamp": "2026-03-07T14:30:22Z",
  "dimensions": { "width": 1280, "height": 480 }
}
```

## Patterns to Follow

### Pattern 1: Lazy Resource Initialization
**What:** Don't launch Chromium until the first tool call. Don't create browser contexts until needed.
**When:** Always. MCP server startup should be fast (<100ms).
**Why:** Users may have Shotput configured but not use it every session. Chromium launch adds 1-3 seconds.

### Pattern 2: Coarse-Grained Tool Design
**What:** Each MCP tool represents a complete user intent, not an atomic API operation.
**When:** Designing all MCP tools.
**Why:** Reduces round-trips between Claude and the MCP server. Each tool call costs ~1 second of latency. A tool that navigates + waits + captures + saves in one call is far better than four separate tools.

### Pattern 3: Structured Return Values
**What:** Every tool returns a JSON object with consistent shape: `{ status, path?, error?, metadata? }`.
**When:** All tool returns.
**Why:** Claude can parse structured results reliably. Include enough context for Claude to report results to the user without another tool call.

### Pattern 4: Graceful Degradation in Wait Strategy
**What:** Try `networkidle`, fall back to `domcontentloaded` + delay, never hang indefinitely.
**When:** Every navigation.
**Why:** Many sites never reach true network idle (analytics, websockets, long-polling). A stuck navigation is the worst UX failure mode.

### Pattern 5: DOM Summary Over Raw HTML
**What:** Return a curated DOM summary from inspect_page, not the full HTML.
**When:** DOM targeting workflow.
**Why:** Full page HTML can be 100KB+, destroying Claude's context window. A structured summary of IDs, headings, sections, and landmarks is typically <5KB and gives Claude everything it needs.

## Anti-Patterns to Avoid

### Anti-Pattern 1: Exposing Playwright API Directly as MCP Tools
**What:** Creating thin wrappers like `goto(url)`, `click(selector)`, `screenshot()` as separate tools.
**Why bad:** Forces Claude to manage browser state across multiple tool calls. Each call has latency. State management across calls is error-prone (what if the page navigated away between calls?).
**Instead:** Bundle navigate + wait + capture into single intent-based tools.

### Anti-Pattern 2: Sending Full HTML to Claude for Selector Identification
**What:** Having inspect_page return raw `page.content()`.
**Why bad:** Modern web pages are 50-500KB of HTML. This destroys the context window and Claude still needs to parse it.
**Instead:** Extract structured DOM summary with IDs, classes, headings, landmarks, and text previews.

### Anti-Pattern 3: Long-Running Visible Browser Without Clear UX
**What:** Opening a visible browser and leaving it open indefinitely without clear feedback.
**Why bad:** User doesn't know if the tool is waiting, finished, or stuck. The browser process leaks if the session is abandoned.
**Instead:** Return immediately with "browser is open, let me know when you're done." Implement a timeout (5 minutes) that auto-closes and warns.

### Anti-Pattern 4: Global Mutable Configuration
**What:** Using a global config object that tools mutate during execution.
**Why bad:** MCP tool calls may overlap or retry. Mutable shared state leads to race conditions.
**Instead:** Pass configuration through tool parameters. Use a read-only defaults config that tools merge with per-call overrides.

## opencode Compatibility Considerations

opencode supports MCP servers via the same stdio transport protocol. Key compatibility considerations:

| Concern | Claude Code | opencode | Resolution |
|---------|-------------|----------|------------|
| MCP transport | stdio | stdio | Same - no changes needed |
| Tool discovery | Automatic via MCP protocol | Automatic via MCP protocol | Same |
| Skill system | `.claude/skills/` with SKILL.md | No equivalent skill system | Need opencode-specific prompt/config |
| Tool permissions | `allowed-tools` in SKILL.md | Permission model varies | MCP server should not depend on skill-level permissions |
| Configuration | `.claude/settings.json` for MCP server config | `opencode.json` or similar | Document both config formats |

**Architectural implication:** The MCP server must be fully functional WITHOUT the skill layer. The skill is a UX enhancement for Claude Code users, not a functional requirement. opencode users interact with MCP tools directly (the AI figures out how to use them from tool descriptions and schemas).

**This means:**
- Tool descriptions must be self-documenting (don't assume skill context)
- Tool input schemas must have clear descriptions on every parameter
- Error messages must be actionable without skill guidance
- The DOM targeting workflow (inspect -> identify -> capture) should be discoverable from tool descriptions alone

## webMCP Integration Points

WebMCP is a W3C standard (early preview in Chrome 146 Canary as of Feb 2026) where websites expose structured tools via `navigator.modelContext`. This is architecturally distinct from Anthropic's MCP but presents future opportunities:

**Current status:** Too early for production dependency. Chrome Canary only, behind a flag.

**Future integration points:**
- Sites with WebMCP support could expose their own navigation/interaction tools, which Shotput could leverage for complex page states (e.g., "open the dropdown menu, then screenshot")
- WebMCP's structured page description could supplement or replace Shotput's DOM inspection for sites that support it
- Shotput could detect WebMCP support on a page and surface available actions to Claude

**Recommendation:** Design Shotput's architecture to NOT depend on WebMCP. Document it as a "future enhancement" opportunity. The inspect_page tool's DOM summary approach works universally regardless of WebMCP adoption.

## Scalability Considerations

| Concern | Single user (target) | Team use | Notes |
|---------|---------------------|----------|-------|
| Chromium instances | 1 browser, few contexts | 1 per user session | Each MCP server is per-user (local process) |
| Memory | ~200-400MB for Chromium | Same per user | Playwright's headless shell mode uses less memory |
| Session storage | JSON files, negligible | Same | Session files are <10KB each |
| Screenshot storage | User's disk | Same | User manages their own disk; no server-side storage |
| Concurrent captures | Sequential (one at a time) | Same | MCP tool calls are sequential per session |

Shotput is inherently a single-user local tool. Scalability concerns are limited to: not leaking Chromium processes, not exhausting disk with screenshots, and keeping memory usage reasonable by closing unused browser contexts.

## Suggested Build Order

Based on component dependencies, build in this order:

### Phase 1: Core capture (no auth, no element targeting)
**Build:** Browser Manager + Screenshot Pipeline + `shotput_capture_screenshot` tool + basic MCP server
**Why first:** This is the foundational happy path. Everything else builds on it.
**Dependencies:** None (greenfield)

### Phase 2: DOM inspection + element targeting
**Build:** `shotput_inspect_page` tool + `shotput_capture_element` tool + DOM summary extraction
**Why second:** Element targeting is the key differentiator. Needs Browser Manager from Phase 1.
**Dependencies:** Phase 1 (Browser Manager, navigation, capture pipeline)

### Phase 3: Session/auth management
**Build:** Session Manager + `shotput_login_interactive` + `shotput_manage_session` + storageState integration
**Why third:** Auth is important but less common than basic screenshots. Needs Browser Manager for context management.
**Dependencies:** Phase 1 (Browser Manager)

### Phase 4: Skill layer + polish
**Build:** SKILL.md + reference docs + `shotput_configure` tool + output naming refinement
**Why fourth:** Skill requires working tools to test against. Polish (naming, metadata) is non-blocking.
**Dependencies:** Phases 1-3 (all tools must exist for skill to reference)

### Phase 5: opencode compatibility + documentation
**Build:** opencode configuration docs, tool description refinement, end-to-end testing in opencode
**Why last:** Per project constraints. Core must work in Claude Code first.
**Dependencies:** Phases 1-4

## Sources

- [MCP TypeScript SDK](https://github.com/modelcontextprotocol/typescript-sdk) - Official SDK, stdio transport
- [MCP Best Practices - Phil Schmid](https://www.philschmid.de/mcp-best-practices) - Tool design: coarse-grained, 5-15 tools per server
- [Block's Playbook for MCP Servers](https://engineering.block.xyz/blog/blocks-playbook-for-designing-mcp-servers) - Service-prefixed naming, outcome-oriented tools
- [Playwright Screenshots](https://playwright.dev/docs/screenshots) - Full page, element, clip, format options
- [Playwright BrowserContext](https://playwright.dev/docs/api/class-browsercontext) - Context management, storageState
- [Playwright Authentication](https://playwright.dev/docs/auth) - storageState save/load pattern
- [Claude Code Skills Documentation](https://code.claude.com/docs/en/skills) - SKILL.md structure, allowed-tools, frontmatter
- [Skill Authoring Best Practices](https://platform.claude.com/docs/en/agents-and-tools/agent-skills/best-practices) - Keep SKILL.md focused, use reference files
- [opencode MCP Servers](https://opencode.ai/docs/mcp-servers/) - stdio transport support, configuration
- [WebMCP W3C Standard](https://webmcp.link/) - Browser-native MCP (early preview, Chrome 146 Canary)
- [WebMCP Updates - Patrick Brosset](https://patrickbrosset.com/articles/2026-02-23-webmcp-updates-clarifications-and-next-steps/) - Current status and timeline
