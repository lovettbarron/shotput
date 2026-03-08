# Requirements: Shotput

**Defined:** 2026-03-07
**Core Value:** Capture precise, publication-ready screenshots of any web page or DOM element on command, with zero external service dependencies.

## v1 Requirements

### Core Capture

- [x] **CAPT-01**: User can capture a full-page screenshot of any URL (local or internet), including content below the fold
- [x] **CAPT-02**: User can capture a viewport-only screenshot showing only visible content at specified dimensions
- [x] **CAPT-03**: User can save screenshots as PNG (lossless) or JPEG (lossy) format
- [x] **CAPT-04**: User can control JPEG compression quality (0-100)
- [x] **CAPT-05**: Tool scrolls through page to trigger lazy-loaded content before capturing full-page screenshots
- [x] **CAPT-06**: Tool waits for page load and network idle before capturing, with configurable wait strategies

### Element Targeting

- [x] **ELEM-01**: User can target a specific DOM element by CSS selector for screenshot capture
- [x] **ELEM-02**: User can describe an element in natural language and Claude identifies the correct CSS selector from the page DOM
- [x] **ELEM-03**: User can specify padding (in pixels) around a targeted element's bounding box
- [x] **ELEM-04**: User can capture an element with a transparent background (no white fill behind the element)
- [x] **ELEM-05**: MCP server provides a page inspection tool that returns a structured DOM summary for Claude to reason about selectors

### Viewport & Display

- [x] **VIEW-01**: User can set custom viewport width and height for captures
- [x] **VIEW-02**: User can set device scale factor (1x, 2x, 3x) for HiDPI/retina-quality captures
- [ ] **VIEW-03**: User can toggle dark or light mode (prefers-color-scheme) before capture
- [ ] **VIEW-04**: User can select from named device presets (e.g., "iPhone 15", "iPad Pro") that set viewport, scale factor, and user agent

### Page Preparation

- [x] **PREP-01**: User can inject custom CSS before capture (e.g., hide cookie banners, override styles)
- [x] **PREP-02**: User can inject custom JavaScript before capture (e.g., dismiss modals, set state)
- [x] **PREP-03**: User can hide or remove specific elements by CSS selector before capture

### Authentication

- [x] **AUTH-01**: User can open a visible (headed) browser window, log in manually, and have the session transferred to headless mode for subsequent captures
- [x] **AUTH-02**: User can inject cookies or session tokens programmatically for authenticated page captures
- [x] **AUTH-03**: Sessions from interactive login persist across multiple captures within the same session
- [x] **AUTH-04**: No user credentials are stored or logged by the tool — only session state (cookies/storage) is captured

### Output & Organization

- [x] **OUTP-01**: User can specify a custom output directory for screenshots
- [x] **OUTP-02**: User can specify a custom filename for individual captures
- [ ] **OUTP-03**: Screenshots are organized by default into folders by site domain and page path with human-readable names
- [ ] **OUTP-04**: Screenshot filenames include timestamps by default for versioning
- [ ] **OUTP-05**: User can run batch captures from a YAML or JSON configuration file specifying multiple URLs, viewports, and selectors

### Architecture & Integration

- [x] **ARCH-01**: MCP server exposes screenshot capture functionality as MCP tools using stdio transport
- [x] **ARCH-02**: MCP server manages Chromium browser lifecycle (launch, reuse, cleanup) with no zombie processes
- [ ] **ARCH-03**: Claude Code skill (SKILL.md) orchestrates MCP tools with natural language interface
- [ ] **ARCH-04**: MCP server is fully functional standalone without the skill layer (for opencode and other MCP clients)
- [ ] **ARCH-05**: opencode can use the MCP server with appropriate configuration documentation

### Quality & Compliance

- [ ] **QUAL-01**: Full test suite covers all capture modes, element targeting, auth flows, and edge cases
- [ ] **QUAL-02**: Comprehensive documentation covers installation, Claude Code integration, MCP server usage, and all features
- [x] **QUAL-03**: Project uses MIT license (permissive, open source)
- [x] **QUAL-04**: All dependencies use licenses compatible with MIT (no GPL, AGPL, or restrictive licenses)
- [x] **QUAL-05**: No bundled fonts or assets with restrictive licenses
- [ ] **QUAL-06**: README includes clear setup instructions, examples, and troubleshooting guide

## v2 Requirements

### Advanced Capture

- **ADVC-01**: User can capture screenshots in WebP format
- **ADVC-02**: User can capture multiple viewports of the same URL in a single command

### WebMCP Integration

- **WMCP-01**: Tool detects when webMCP is available and can leverage it for site navigation
- **WMCP-02**: Documentation describes webMCP integration opportunities

### Advanced Output

- **AOUT-01**: User can attach metadata (tags, descriptions) to captures
- **AOUT-02**: User can export a manifest of all captures in a session (JSON)

## Out of Scope

| Feature | Reason |
|---------|--------|
| Visual regression / diff comparison | Percy, Chromatic, BackstopJS own this space |
| Cross-browser rendering | Chromium-only keeps scope manageable |
| Cloud/SaaS screenshot API | Core value is local-only, zero external dependencies |
| Image editing or annotation | Different product category (Skitch, CleanShot) |
| Scheduled/recurring captures | Monitoring tools handle this; users can wrap in cron |
| Video or animation capture | Fundamentally different feature with storage/format concerns |
| PDF generation | Different output domain with its own formatting challenges |
| Browser extension | Headless Chromium is more powerful and automatable |
| Built-in image optimization | Users can optimize separately with imagemin/sharp |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| CAPT-01 | Phase 1 | Complete |
| CAPT-02 | Phase 1 | Complete |
| CAPT-03 | Phase 1 | Complete |
| CAPT-04 | Phase 1 | Complete |
| CAPT-05 | Phase 1 | Complete |
| CAPT-06 | Phase 1 | Complete |
| VIEW-01 | Phase 1 | Complete |
| VIEW-02 | Phase 1 | Complete |
| ARCH-01 | Phase 1 | Complete |
| ARCH-02 | Phase 1 | Complete |
| OUTP-01 | Phase 1 | Complete |
| OUTP-02 | Phase 1 | Complete |
| QUAL-03 | Phase 1 | Complete |
| QUAL-04 | Phase 1 | Complete |
| QUAL-05 | Phase 1 | Complete |
| ELEM-01 | Phase 2 | Complete |
| ELEM-02 | Phase 2 | Complete |
| ELEM-03 | Phase 2 | Complete |
| ELEM-04 | Phase 2 | Complete |
| ELEM-05 | Phase 2 | Complete |
| PREP-01 | Phase 2 | Complete |
| PREP-02 | Phase 2 | Complete |
| PREP-03 | Phase 2 | Complete |
| AUTH-01 | Phase 3 | Complete |
| AUTH-02 | Phase 3 | Complete |
| AUTH-03 | Phase 3 | Complete |
| AUTH-04 | Phase 3 | Complete |
| ARCH-03 | Phase 4 | Pending |
| VIEW-03 | Phase 4 | Pending |
| VIEW-04 | Phase 4 | Pending |
| OUTP-03 | Phase 4 | Pending |
| OUTP-04 | Phase 4 | Pending |
| OUTP-05 | Phase 4 | Pending |
| ARCH-04 | Phase 5 | Pending |
| ARCH-05 | Phase 5 | Pending |
| QUAL-01 | Phase 5 | Pending |
| QUAL-02 | Phase 5 | Pending |
| QUAL-06 | Phase 5 | Pending |

**Coverage:**
- v1 requirements: 38 total
- Mapped to phases: 38
- Unmapped: 0

---
*Requirements defined: 2026-03-07*
*Last updated: 2026-03-07 after roadmap creation*
