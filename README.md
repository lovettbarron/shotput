# Shotput

Screenshot capture tool for Claude Code. Launches headless Chromium to capture full-page or element-targeted screenshots of any URL — local or remote — with zero external service dependencies.

Built as an MCP server, Shotput integrates directly into Claude Code (and any MCP-compatible client) so you can capture publication-ready screenshots from your AI workflow.

## Features

### Core Capture (`shotput_capture`)
- Full-page and viewport screenshots in PNG or JPEG
- Configurable viewport dimensions and device scale factor (up to 3x retina)
- Auto-scroll for lazy-loaded content
- Wait strategies: `networkidle`, `domcontentloaded`, `load`, or custom delay
- Custom output directory and filename
- Transparent background support (PNG)

### Element Targeting
- Capture specific DOM elements by CSS selector
- Configurable padding around targeted elements
- CSS/JS injection before capture (hide cookie banners, dismiss modals, adjust styles)
- Hide elements by selector before capture

### Page Inspection (`shotput_inspect`)
- Inspect page DOM structure to discover elements and selectors
- Designed for Claude-assisted natural language element targeting — describe what you want, Claude finds the selector

## Installation

```bash
# Clone and install
git clone https://github.com/lovettbarron/shotput.git
cd shotput
npm install
npx playwright install chromium
npm run build
```

### Claude Code MCP Configuration

Add to your Claude Code MCP settings:

```json
{
  "mcpServers": {
    "shotput": {
      "command": "node",
      "args": ["/path/to/shotput/dist/index.js"]
    }
  }
}
```

## Usage

Once configured as an MCP server, the tools are available directly in Claude Code.

### Capture a full page

```
Take a screenshot of https://example.com
```

### Capture a specific element

```
Capture the hero section of https://example.com using the selector ".hero"
```

### Capture with custom settings

```
Screenshot https://example.com at 1440x900 with 2x scale in JPEG format
```

### Inspect a page for selectors

```
Inspect https://example.com so I can find the right selector for the navigation bar
```

### MCP Tool Parameters

**`shotput_capture`**

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `url` | string | *required* | URL to capture |
| `fullPage` | boolean | `false` | Capture full scrollable page |
| `format` | `"png"` \| `"jpeg"` | `"png"` | Output format |
| `quality` | number | — | JPEG quality (0-100) |
| `width` | integer | `1280` | Viewport width |
| `height` | integer | `720` | Viewport height |
| `scale` | number | `1` | Device scale factor (1-3) |
| `outputDir` | string | cwd | Output directory |
| `filename` | string | auto | Output filename |
| `wait` | string \| number | `"networkidle"` | Wait strategy or ms delay |
| `autoScroll` | boolean | `true` | Scroll page to trigger lazy loading |
| `timeout` | number | `30000` | Navigation timeout in ms |
| `selector` | string | — | CSS selector to capture specific element |
| `padding` | number | `0` | Padding around selected element (px) |
| `omitBackground` | boolean | `false` | Transparent background (PNG only) |
| `injectCSS` | string | — | CSS to inject before capture |
| `injectJS` | string | — | JavaScript to execute before capture |
| `hideSelectors` | string[] | — | CSS selectors of elements to hide |

**`shotput_inspect`**

Inspects the DOM structure of a page to help identify selectors for element capture.

## Development

```bash
npm run dev      # Watch mode
npm test         # Run tests
npm run build    # Production build
```

## Tech Stack

- **Playwright** — headless Chromium automation
- **MCP SDK** — Model Context Protocol server
- **Zod** — schema validation
- **tsup** — TypeScript bundler
- **Vitest** — test runner

## Roadmap

- [x] **Phase 1: Core Capture Engine** — MCP server, full-page/viewport screenshots, format control, browser lifecycle
- [x] **Phase 2: Element Targeting** — DOM inspection, element screenshots, CSS/JS injection, page preparation
- [ ] **Phase 3: Authentication** — Interactive login flow, session persistence, cookie injection
- [ ] **Phase 4: Skill Layer + Display Polish** — Claude Code skill, dark/light mode, device presets, batch captures
- [ ] **Phase 5: Cross-Client Compatibility** — opencode support, comprehensive test suite, documentation

## License

MIT
