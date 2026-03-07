# Feature Landscape

**Domain:** Headless browser screenshot capture tool (MCP server + Claude Code skill)
**Researched:** 2026-03-07

## Table Stakes

Features users expect from any screenshot capture tool. Missing any of these and the tool feels broken or incomplete.

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Full-page screenshot | Every tool has this (Puppeteer, Playwright, capture-website, shot-scraper, pageres). It's the most basic use case. | Low | Puppeteer `fullPage: true`, Playwright `fullPage: true` |
| Viewport-only screenshot | Default behavior in all browser screenshot tools. Users need "what you see" captures for above-the-fold content. | Low | Default mode, no scrolling |
| Element-targeted screenshot | Puppeteer `ElementHandle.screenshot()`, Playwright `locator.screenshot()`, capture-website `element` option, BackstopJS `selectors` array, shot-scraper `--selector`. Universal. | Low | CSS selector input is standard; Shotput's NL layer sits on top |
| PNG and JPEG output formats | Every tool supports at minimum PNG and JPEG. WebP is increasingly common (Puppeteer, capture-website). | Low | PNG for lossless/transparency, JPEG for smaller files |
| Custom viewport dimensions (width/height) | All tools support this. Required for responsive design verification and consistent captures. | Low | Standard: 1280x720 default, configurable |
| Quality control (JPEG/WebP compression) | Puppeteer `quality` 0-100, Playwright `quality` 0-100, capture-website `quality`. Standard parameter. | Low | Only applies to lossy formats |
| Wait for page load / network idle | Every serious tool handles this. Pages with async content need wait strategies. | Low | `waitUntil: 'networkidle0'` (Puppeteer) or `'networkidle'` (Playwright) |
| Custom output path/filename | Basic file management. All CLI tools and APIs support this. | Low | User-specified save location |
| Transparent background | Puppeteer `omitBackground`, Playwright `omitBackground`, capture-website `omitBackground`. Expected for element captures used in designs. | Low | Removes default white background |
| Device scale factor / HiDPI | capture-website `scaleFactor`, Playwright `deviceScaleFactor`. Retina screenshots are expected for publication-quality output. | Low | 2x is common default for retina |

## Differentiators

Features that set Shotput apart. Not universally expected, but create real value.

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| Natural language element targeting | **Shotput's primary differentiator.** No existing tool does this. Users say "the pricing table" or "the hero section" instead of writing CSS selectors. Claude interprets the page DOM and identifies the right element. Prior art is limited to generic LLM prompting guides (DocsBot, Scrapfly blog posts) -- no tool has productized NL-to-selector for screenshots. | Medium | Requires sending DOM/accessibility tree to Claude, returning a selector. shot-scraper has `--selector`, capture-website has `element`, but all require CSS selectors. |
| Configurable padding around elements | shot-scraper has `--padding`. Most other tools don't. Padding turns a tight element crop into a publication-ready screenshot with breathing room. | Low | Simple bounding box expansion. shot-scraper validates this is valued by users. |
| Dark/light mode toggle | capture-website has `darkMode`, Playwright can emulate `prefers-color-scheme`. Not all tools expose this. Documentation authors need both variants. | Low | `page.emulateMediaFeatures([{name: 'prefers-color-scheme', value: 'dark'}])` |
| Device emulation presets | capture-website offers named `emulateDevice` (e.g., 'iPhone X'). Playwright has a full device registry. Saves users from memorizing viewport numbers. | Low | Playwright ships a devices dictionary with 100+ presets |
| Interactive auth flow (visible browser for login) | **Strong differentiator.** Most tools handle auth via cookie injection or HTTP headers only. Opening a visible browser for the user to manually authenticate, then transferring the session to headless, is rare. The Playwright MCP server docs explicitly call out authentication as "a major problem" for AI agents. | High | Open headed browser -> user logs in -> capture cookies/storage -> switch to headless. Security-sensitive. |
| Cookie/session token injection | capture-website supports `cookies` and `authentication` (HTTP basic). Puppeteer/Playwright support `page.setCookie()`. Standard but not always exposed at the tool level. | Medium | Must handle cookie format parsing, domain scoping |
| Batch/multi-URL captures | shot-scraper's `multi` command with YAML config is its killer feature for documentation workflows. pageres supports multiple URLs with multiple resolutions in one command. | Medium | YAML or JSON config defining multiple capture jobs |
| Lazy content preloading | capture-website's `preloadLazyContent` scrolls through the page to trigger lazy-loaded images/widgets before capture. Critical for modern SPAs. | Medium | Scroll viewport-by-viewport, wait for network idle at each step |
| CSS/JS injection before capture | capture-website `styles` and `modules`, Playwright `addStyleTag`/`addScriptTag`, shot-scraper `--javascript`. Useful for hiding cookie banners, ads, dynamic elements. | Low | Inject before capture to clean up the page |
| Hide/remove elements before capture | capture-website `hideElements` (visibility:hidden) and `removeElements` (display:none). Clean up pages before capture -- hide cookie banners, chat widgets, ads. | Low | Apply CSS to matched selectors before screenshot |
| Organized output by site/page | Most tools dump files to a flat directory. Shotput's human-readable naming with site/page hierarchy and timestamps is genuinely useful for documentation workflows. | Medium | Directory structure: `output/{domain}/{page-slug}/{timestamp}.png` |
| MCP server architecture | Existing MCP screenshot servers (sethbang/mcp-screenshot-server, ananddtyagi/webpage-screenshot-mcp) prove demand. But they're basic -- URL in, PNG out. Shotput's richer feature set via MCP tools is differentiated. | High | Core architectural decision. Multiple tools exposed via MCP protocol. |
| Claude Code skill orchestration | No existing MCP screenshot tool has a companion skill layer. The skill translates conversational requests into multi-step MCP tool calls. | Medium | Skill YAML + system prompt that knows the MCP tools |

## Anti-Features

Features to explicitly NOT build. These are tempting but out of scope or counterproductive.

| Anti-Feature | Why Avoid | What to Do Instead |
|--------------|-----------|-------------------|
| Visual regression / diff comparison | Percy, Chromatic, BackstopJS own this space with baseline management, AI-powered diff suppression, cross-browser matrices. Building this means competing with well-funded tools. Shotput captures screenshots; it does not compare them. | Output clean screenshots. Users can pipe into Percy/BackstopJS/Chromatic for regression if they want. |
| Cross-browser rendering | Percy offers Chrome/Firefox/Safari. This requires maintaining multiple browser engines. Chromium-only is the right constraint. | Use Chromium only. Document this clearly. |
| Cloud/SaaS screenshot API | ScreenshotOne, Scrnify, BrowserStack Percy are cloud services. Shotput's value is local-only, zero external dependencies. | Everything runs locally. No API keys, no cloud. |
| Image editing/annotation | Adding arrows, text overlays, cropping, etc. is a different product category. Tools like Skitch, Markup Hero, and CleanShot own this. | Output raw screenshots. Post-processing is the user's responsibility or a separate tool. |
| Scheduled/recurring captures | Monitoring tools (Datadog, Checkly) handle periodic screenshots. Shotput is on-demand. Adding scheduling means building a daemon/cron system. | On-demand only. Users can wrap in cron/CI themselves. |
| Video/animation capture | Puppeteer and Playwright can record video, but this is a fundamentally different feature with different storage, format, and playback concerns. | Screenshots only. Explicitly out of scope. |
| PDF generation | Puppeteer's `page.pdf()` and Playwright's equivalent exist, but PDF is a different output domain with its own formatting challenges (page breaks, headers/footers). | Stick to image formats (PNG, JPEG, optionally WebP). |
| Browser extension | Would limit to extension-compatible workflows. Headless Chromium is more powerful and automatable. | Headless-only architecture. |
| Built-in image optimization/compression | Tools like imagemin, sharp handle this well. Building optimization into the capture tool adds complexity without clear value. | Output at requested quality. Users can optimize separately. |

## Feature Dependencies

```
Headless browser launch -> Navigate to URL -> All capture features depend on this

Element targeting (CSS selector) -> Natural language targeting (NL requires selector resolution)
                                 -> Padding around elements (needs bounding box first)

Page load wait -> Lazy content preloading (preload is an extension of waiting)
              -> Screenshot capture (must wait before capturing)

Cookie/session injection -> Authenticated page captures
Interactive auth flow -> Cookie extraction -> Cookie/session injection (auth flow produces cookies for reuse)

Viewport dimensions -> Device emulation presets (presets set viewport + UA + scale)
                    -> Full-page capture (viewport width determines layout)

CSS/JS injection -> Hide/remove elements (specific case of injection)
                 -> Dark mode toggle (implemented via media feature emulation or CSS injection)

MCP server (tool layer) -> Claude Code skill (orchestration layer)
                        -> opencode compatibility (adapts skill layer)

Single URL capture -> Batch/multi-URL captures (batch is iteration over single)
```

## MVP Recommendation

Prioritize for first working version:

1. **Full-page and viewport screenshots** -- core functionality, lowest complexity
2. **Element-targeted screenshots via CSS selector** -- foundation for NL targeting
3. **Natural language element targeting** -- primary differentiator, build on top of CSS selector support
4. **PNG/JPEG output with quality control** -- table stakes
5. **Custom viewport dimensions** -- table stakes
6. **Configurable padding around elements** -- low complexity, high value for documentation use case
7. **MCP server with basic tools** -- architectural foundation

Defer to later phases:
- **Interactive auth flow**: High complexity, requires headed browser orchestration, security considerations. Ship basic cookie injection first.
- **Batch/multi-URL captures**: Valuable but not needed for single-screenshot workflows. Users can call the tool multiple times initially.
- **Device emulation presets**: Nice-to-have. Custom viewport dimensions cover the core need. Named presets are convenience.
- **Lazy content preloading**: Medium complexity. Most documentation targets don't have aggressive lazy loading.
- **opencode compatibility**: Explicitly last per project constraints.

## Sources

- [Playwright Screenshots API](https://playwright.dev/docs/screenshots)
- [Puppeteer Screenshot Options](https://pptr.dev/api/puppeteer.screenshotoptions)
- [Puppeteer Screenshots Guide](https://pptr.dev/guides/screenshots)
- [capture-website (GitHub)](https://github.com/sindresorhus/capture-website)
- [capture-website-cli (GitHub)](https://github.com/sindresorhus/capture-website-cli)
- [shot-scraper (GitHub)](https://github.com/simonw/shot-scraper)
- [shot-scraper announcement](https://simonwillison.net/2022/Mar/10/shot-scraper/)
- [pageres (GitHub)](https://github.com/sindresorhus/pageres)
- [BackstopJS (GitHub)](https://github.com/garris/BackstopJS)
- [Percy by BrowserStack](https://www.browserstack.com/percy)
- [Chromatic vs Percy comparison](https://www.chromatic.com/compare/percy)
- [Playwright MCP Server (GitHub)](https://github.com/microsoft/playwright-mcp)
- [MCP Screenshot Server by sethbang (GitHub)](https://github.com/sethbang/mcp-screenshot-server)
- [Webpage Screenshot MCP (GitHub)](https://github.com/ananddtyagi/webpage-screenshot-mcp)
- [Kong docs screenshot automation](https://konghq.com/blog/engineering/docs-as-code-screenshot-automation)
- [Automate screenshots with Playwright MCP (DEV)](https://dev.to/debs_obrien/automate-your-screenshot-documentation-with-playwright-mcp-3gk4)
- [NL to CSS selectors with ChatGPT (Scrapfly)](https://scrapfly.io/blog/posts/finding-web-selectors-with-chatgpt)
- [DocsBot CSS Selector Generator](https://docsbot.ai/prompts/technical/css-selector-generator)
