# Technology Stack

**Project:** Shotput -- Headless Browser Screenshot Tool (MCP Server + Claude Code Skill)
**Researched:** 2026-03-07

## Recommended Stack

### Core Framework

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| [Playwright](https://playwright.dev/) | 1.58.x | Headless browser automation and screenshot capture | Superior to Puppeteer for this use case: built-in element screenshot support, cross-browser (Chromium/Firefox/WebKit), actively maintained by Microsoft, better auto-waiting, native `locator.screenshot()` API. Puppeteer is Chrome-only with a declining community. Playwright's locator-based API maps cleanly to Claude identifying DOM elements. |
| [TypeScript](https://www.typescriptlang.org/) | 5.x | Primary language | Type safety is critical for MCP tool schemas (input/output contracts). Zod + TypeScript gives end-to-end type safety from MCP schema validation through browser automation. JavaScript is viable but loses compile-time guarantees on tool parameter shapes. |
| [Node.js](https://nodejs.org/) | 22 LTS | Runtime | Current LTS with native ESM support. Required by both Playwright and the MCP TypeScript SDK. |

### MCP Server

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| [@modelcontextprotocol/sdk](https://github.com/modelcontextprotocol/typescript-sdk) | 1.27.x (v1 line) | MCP server framework | The official TypeScript SDK. Use v1.x -- it is the recommended production version. v2 is pre-alpha (Q1 2026 stable anticipated) and not ready. v1.x will receive support for at least 6 months after v2 launches, so no urgency to adopt v2. |
| [Zod](https://zod.dev/) | 3.x (via `zod` import) | Schema validation for MCP tool inputs | Required peer dependency of @modelcontextprotocol/sdk. Defines tool parameter schemas that Claude uses to understand what arguments each tool accepts. Use Zod v3 import path (`import { z } from 'zod'`) to match SDK v1.x expectations. |

### Image Processing

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| [sharp](https://sharp.pixelplumbing.com/) | 0.34.x | Post-capture image processing (padding, cropping, format conversion) | Playwright has no native padding option for element screenshots (confirmed via [GitHub issues #16928](https://github.com/microsoft/playwright/issues/16928) and [#28394](https://github.com/microsoft/playwright/issues/28394)). Sharp is the fastest Node.js image processing library (powered by libvips), has zero runtime dependencies on most platforms, and handles the extend/crop/composite operations needed to add configurable padding around element screenshots. MIT licensed. |

### Testing

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| [Vitest](https://vitest.dev/) | 4.x | Unit and integration testing | Modern, fast, native TypeScript and ESM support. Compatible with the same ecosystem as the project (Node.js + TypeScript). Superior DX over Jest for ESM projects -- no transform configuration needed. |
| [@playwright/test](https://playwright.dev/docs/test-configuration) | 1.58.x | End-to-end browser testing | Use Playwright's own test runner for integration tests that verify actual screenshot capture against real pages. Shares the same Playwright version as the core library -- no version mismatch risk. |

### Build and Development

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| [tsx](https://tsx.is/) | 4.21.x | TypeScript execution during development | Runs TypeScript directly via esbuild. Used for `npx tsx src/index.ts` during development and as the MCP server entry point for stdio transport. No separate build step needed for development. |
| [tsup](https://tsup.egoist.dev/) | 8.x | Production bundling | Zero-config TypeScript bundler powered by esbuild. Produces clean ESM output for distribution. Use for building the publishable package. |
| [npm](https://www.npmjs.com/) | 10.x (ships with Node 22) | Package manager | Standard, no reason to add pnpm/yarn complexity for a single-package project. npm workspaces available if monorepo structure emerges later. |

### Claude Code Skill

| Technology | Purpose | Why |
|------------|---------|-----|
| [SKILL.md](https://code.claude.com/docs/en/skills) | Skill definition file | Claude Code skills are Markdown files with YAML frontmatter. No code required for the skill layer -- it is pure prompt engineering that orchestrates MCP tools. The skill tells Claude how to translate natural language screenshot requests into MCP tool calls. |

## Architecture: MCP Server + Skill Layering

The project has two distinct layers with different technology needs:

### Layer 1: MCP Server (TypeScript)
- **What it is:** A Node.js process exposing screenshot tools via the MCP protocol over stdio transport
- **Transport:** stdio (standard for local MCP servers in Claude Code, no network exposure)
- **Tools exposed:** `capture_screenshot`, `capture_element`, `list_viewports`, `set_dark_mode`, `manage_auth_session`, etc.
- **Registration:** `claude mcp add --transport stdio shotput -- npx tsx /path/to/src/index.ts` (dev) or `npx shotput` (published)

### Layer 2: Claude Code Skill (Markdown)
- **What it is:** A `SKILL.md` file in `.claude/skills/shotput/` that teaches Claude how to orchestrate the MCP tools
- **No code:** Pure instruction set -- Claude reads it and knows how to translate "screenshot the pricing section of stripe.com on mobile" into the right sequence of MCP tool calls
- **Supporting files:** Templates, examples in the skill directory

## MCP Server Entry Point Pattern

```typescript
// src/index.ts
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

const server = new McpServer({
  name: "shotput",
  version: "1.0.0",
});

server.tool(
  "capture_screenshot",
  "Capture a screenshot of a web page or element",
  {
    url: z.string().url().describe("URL to capture"),
    selector: z.string().optional().describe("CSS selector for element capture"),
    viewport: z.object({
      width: z.number().default(1280),
      height: z.number().default(720),
    }).optional(),
    format: z.enum(["png", "jpeg"]).default("png"),
    padding: z.number().default(0).describe("Pixels of padding around element"),
    darkMode: z.boolean().default(false),
    fullPage: z.boolean().default(false),
    outputDir: z.string().optional(),
  },
  async (params) => {
    // Browser launch, navigation, screenshot logic
    // Returns { content: [{ type: "image", data: base64, mimeType }] }
  }
);

const transport = new StdioServerTransport();
await server.connect(transport);
```

## Alternatives Considered

| Category | Recommended | Alternative | Why Not |
|----------|-------------|-------------|---------|
| Browser automation | **Playwright** | Puppeteer 24.x | Puppeteer is Chrome-only (Firefox support experimental/unreliable). Community activity declining -- GitHub discussions show Puppeteer community "a bit deserted" while Playwright is actively growing. Puppeteer is marginally faster for simple scripts (~30% in benchmarks) but Playwright's richer API (locators, auto-wait, multi-browser) matters more for a screenshot tool. |
| Browser automation | **Playwright** | Selenium | Over-engineered for headless screenshots. No modern Node.js-first API. Slow. |
| MCP SDK | **@modelcontextprotocol/sdk v1.x** | @modelcontextprotocol/sdk v2.x | v2 is pre-alpha. Migrating later is straightforward (same team, documented migration path). Ship on stable. |
| MCP SDK | **@modelcontextprotocol/sdk** | Custom JSON-RPC | MCP is the standard protocol -- building custom transport wastes effort and loses Claude Code integration benefits. |
| Testing | **Vitest** | Jest | Jest has poor ESM support, requires transforms for TypeScript, slower. Vitest is the modern standard for TypeScript projects. |
| Image processing | **sharp** | Jimp | Jimp is pure JavaScript -- 10-50x slower than sharp for image operations. For a tool that may process many screenshots, performance matters. |
| Image processing | **sharp** | Canvas (node-canvas) | Canvas requires native Cairo dependencies. sharp's libvips is pre-built for most platforms. Canvas is overkill -- we need crop/extend/composite, not drawing. |
| Language | **TypeScript** | JavaScript | MCP tool schemas are contracts. TypeScript catches schema/handler mismatches at compile time. Every MCP tutorial and the official SDK itself are TypeScript-first. |
| Package manager | **npm** | pnpm / yarn | Single package, no monorepo. npm ships with Node.js. Adding pnpm/yarn is complexity without benefit here. |
| Build | **tsup** | tsc | tsc produces verbose output, no bundling. tsup gives single-file ESM output suitable for `npx` distribution. |
| Dev runner | **tsx** | ts-node | ts-node has ongoing ESM compatibility issues. tsx "just works" with ESM and is faster (esbuild-based). |

## Project File Structure

```
shotput/
├── .claude/
│   └── skills/
│       └── shotput/
│           ├── SKILL.md              # Claude Code skill definition
│           └── examples/
│               └── usage-examples.md # Example screenshot requests
├── src/
│   ├── index.ts                      # MCP server entry point
│   ├── server.ts                     # McpServer setup and tool registration
│   ├── tools/
│   │   ├── capture.ts                # Screenshot capture tool implementation
│   │   ├── viewport.ts               # Viewport/device preset tool
│   │   └── auth.ts                   # Authentication session management
│   ├── browser/
│   │   ├── manager.ts                # Browser lifecycle (launch, close, reuse)
│   │   ├── navigation.ts             # Page navigation and waiting
│   │   └── screenshot.ts             # Core screenshot logic (full page, element, padding)
│   ├── image/
│   │   └── processor.ts              # Sharp-based padding/cropping/format conversion
│   └── output/
│       └── organizer.ts              # File naming, directory structure, timestamps
├── tests/
│   ├── unit/                         # Vitest unit tests
│   └── integration/                  # Playwright test runner integration tests
├── package.json
├── tsconfig.json
├── tsup.config.ts
├── vitest.config.ts
└── .mcp.json                         # Project-scope MCP server config (for contributors)
```

## Installation

```bash
# Core dependencies
npm install @modelcontextprotocol/sdk zod playwright sharp

# Dev dependencies
npm install -D typescript tsx tsup vitest @playwright/test @types/node

# Install Playwright browsers (Chromium is sufficient for screenshots)
npx playwright install chromium
```

## Key Configuration

### tsconfig.json
```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "strict": true,
    "outDir": "dist",
    "rootDir": "src",
    "declaration": true,
    "esModuleInterop": true,
    "skipLibCheck": true
  },
  "include": ["src"]
}
```

### package.json (key fields)
```json
{
  "type": "module",
  "bin": {
    "shotput": "./dist/index.js"
  },
  "scripts": {
    "dev": "tsx src/index.ts",
    "build": "tsup src/index.ts --format esm --dts",
    "test": "vitest",
    "test:integration": "playwright test"
  }
}
```

### .mcp.json (for project contributors)
```json
{
  "mcpServers": {
    "shotput": {
      "command": "npx",
      "args": ["tsx", "src/index.ts"]
    }
  }
}
```

## Confidence Assessment

| Decision | Confidence | Basis |
|----------|------------|-------|
| Playwright over Puppeteer | HIGH | Official docs, multiple 2025-2026 comparisons, GitHub activity trends, feature set comparison |
| @modelcontextprotocol/sdk v1.x | HIGH | Official SDK repo README explicitly recommends v1.x for production, v2 pre-alpha confirmed |
| TypeScript | HIGH | MCP SDK is TypeScript-first, all official examples use TypeScript, type safety for tool schemas |
| sharp for padding | HIGH | Playwright confirmed to lack native padding (GitHub issues #16928, #28394), sharp is the standard Node.js image lib |
| Vitest over Jest | HIGH | ESM-native, TypeScript-native, widely adopted (1600+ dependent packages on npm) |
| stdio transport | HIGH | Official Claude Code docs recommend stdio for local MCP servers, no network exposure needed |
| Zod v3 import path | MEDIUM | SDK v1.x uses Zod as peer dep; v2 requires Zod v4. For v1.x, Zod v3 import is correct. Verify against SDK v1.x peer dep spec. |
| tsup for bundling | MEDIUM | Standard choice for TypeScript CLI tools, but verify it handles Playwright's native bindings correctly (may need external marking) |
| npm over pnpm | MEDIUM | Adequate for single package. If workspace needs emerge, revisit. |

## Sources

- [Playwright vs Puppeteer comparison (BrowserStack, 2026)](https://www.browserstack.com/guide/playwright-vs-puppeteer)
- [Puppeteer vs Playwright performance (Skyvern, 2025)](https://www.skyvern.com/blog/puppeteer-vs-playwright-complete-performance-comparison-2025/)
- [Playwright screenshot docs](https://playwright.dev/docs/screenshots)
- [Playwright padding feature request #16928](https://github.com/microsoft/playwright/issues/16928)
- [Playwright margin feature request #28394](https://github.com/microsoft/playwright/issues/28394)
- [MCP TypeScript SDK repo](https://github.com/modelcontextprotocol/typescript-sdk)
- [@modelcontextprotocol/sdk npm](https://www.npmjs.com/package/@modelcontextprotocol/sdk) -- v1.27.1
- [Claude Code skills documentation](https://code.claude.com/docs/en/skills)
- [Claude Code MCP documentation](https://code.claude.com/docs/en/mcp)
- [sharp npm](https://www.npmjs.com/package/sharp) -- v0.34.5
- [Vitest npm](https://www.npmjs.com/package/vitest) -- v4.0.18
- [tsx npm](https://www.npmjs.com/package/tsx) -- v4.21.0
- [Zod npm](https://www.npmjs.com/package/zod) -- v4.3.6 (v3 at root import, v4 at `zod/v4`)
- [Playwright npm](https://www.npmjs.com/package/playwright) -- v1.58.2
- [Puppeteer npm](https://www.npmjs.com/package/puppeteer) -- v24.38.0
