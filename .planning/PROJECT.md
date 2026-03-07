# Shotput

## What This Is

Shotput is an open-source screenshot capture tool built as a Claude Code skill (with MCP server backend) that launches headless Chromium to visit any URL — local or remote — and capture full-page or element-targeted screenshots with configurable padding. It's designed for developers and content creators who need screenshots for documentation, marketing materials, support content, and visual design research.

## Core Value

Capture precise, publication-ready screenshots of any web page or DOM element on command, with zero external service dependencies.

## Requirements

### Validated

(None yet — ship to validate)

### Active

- [ ] Launch headless Chromium and navigate to any URL (local or internet)
- [ ] Capture full-page screenshots in PNG and JPEG formats
- [ ] Target specific DOM elements using natural language descriptions (Claude identifies the selector)
- [ ] Capture element-level screenshots with configurable padding around the target
- [ ] Control viewport dimensions to simulate devices (mobile, tablet, desktop)
- [ ] Toggle dark/light mode (prefers-color-scheme) before capture
- [ ] Organize output by site/page with human-readable names and timestamps, with user override
- [ ] Store screenshots in a user-specified local folder
- [ ] Support authenticated pages via interactive login flow (open visible browser for user to authenticate, then capture session for headless use)
- [ ] Support authenticated pages via cookie/session token injection
- [ ] MCP server architecture — browser management and capture logic as MCP tools
- [ ] Claude Code skill that orchestrates MCP tools with natural language interface
- [ ] Full test suite covering all capture modes and edge cases
- [ ] Comprehensive documentation: installation, deployment, Claude integration
- [ ] opencode compatibility (as a final phase)
- [ ] Assess and document webMCP integration opportunities for site navigation
- [ ] MIT or Apache 2.0 license (permissive, open source)
- [ ] License audit: verify all dependencies use compatible licenses
- [ ] Avoid bundled fonts or assets with restrictive licenses

### Out of Scope

- External screenshot services (SaaS APIs) — must be fully local
- Video or animation capture — screenshots only
- Browser extensions — headless Chromium only
- Image editing or annotation — capture only, post-processing is external
- Real-time monitoring or scheduled captures — on-demand only

## Context

- Built as a Claude Code skill following skill development best practices
- MCP server provides the tool layer; skill provides the natural language orchestration
- Puppeteer or Playwright are the likely headless browser libraries (research will confirm)
- Natural language DOM targeting is a key differentiator — user describes what to capture, Claude figures out the selector
- Auth flow: for pages behind login, Shotput can open a visible browser window for the user to manually authenticate, then transfer the session to headless mode for captures
- webMCP may offer complementary navigation capabilities — research phase will assess opportunities
- The project will be open source from day one with excellent documentation for community adoption

## Constraints

- **No external services**: Everything runs locally — no cloud APIs, no SaaS dependencies
- **License compliance**: All dependencies must have permissive licenses compatible with the project license
- **Font safety**: No bundled fonts that could carry license restrictions
- **Skill best practices**: Follow Claude Code skill development conventions
- **Cross-tool compatibility**: Must work in Claude Code, with opencode support added last

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| MCP server + skill architecture | Separates browser concerns from orchestration; MCP is the standard tool protocol | -- Pending |
| Natural language DOM targeting over CSS selectors | Better UX — users describe what they see, Claude translates to selectors | -- Pending |
| Interactive auth flow (visible browser) | Users can log into any site without exposing credentials to the tool | -- Pending |
| opencode compatibility last | Get core working in Claude Code first, then adapt | -- Pending |

---
*Last updated: 2026-03-07 after initialization*
