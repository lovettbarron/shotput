# Roadmap: Shotput

## Overview

Shotput delivers a complete screenshot capture tool in five phases, moving from a working MCP server with basic captures, through element targeting and authentication, to skill orchestration and cross-client compatibility. Each phase delivers a coherent, independently verifiable capability. The first phase is the largest because it establishes the browser manager, capture pipeline, and MCP server foundation that everything else depends on.

## Phases

**Phase Numbering:**
- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

- [ ] **Phase 1: Core Capture Engine** - MCP server with full-page/viewport screenshots, format control, and robust browser lifecycle
- [ ] **Phase 2: Element Targeting** - DOM inspection, element screenshots, natural language targeting, page preparation
- [ ] **Phase 3: Authentication** - Interactive login flow, session persistence, cookie injection
- [ ] **Phase 4: Skill Layer + Display Polish** - Claude Code skill, dark/light mode, device presets, output organization, batch captures
- [ ] **Phase 5: Cross-Client Compatibility + Quality** - opencode support, test suite, documentation, README

## Phase Details

### Phase 1: Core Capture Engine
**Goal**: Users can capture full-page and viewport screenshots of any URL via MCP tools, with format and quality control, reliable browser lifecycle, and basic output management
**Depends on**: Nothing (first phase)
**Requirements**: CAPT-01, CAPT-02, CAPT-03, CAPT-04, CAPT-05, CAPT-06, VIEW-01, VIEW-02, ARCH-01, ARCH-02, OUTP-01, OUTP-02, QUAL-03, QUAL-04, QUAL-05
**Success Criteria** (what must be TRUE):
  1. User can call `shotput_capture` via an MCP client and receive a full-page PNG or JPEG screenshot of any reachable URL
  2. User can set viewport dimensions and device scale factor and the resulting screenshot reflects those settings
  3. User can specify output directory and filename, and the file appears at the expected path
  4. Browser processes are cleaned up after captures complete -- no zombie Chromium processes remain after the MCP server shuts down
  5. Project has a permissive license file and all dependencies pass a license compatibility check
**Plans:** 1/3 plans executed

Plans:
- [ ] 01-01-PLAN.md — Project foundation: dependencies, build config, license, types, test scaffolds
- [ ] 01-02-PLAN.md — Capture engine: browser lifecycle, auto-scroll, output handling, capture pipeline
- [ ] 01-03-PLAN.md — MCP server: tool registration, stdio transport, response formatting

### Phase 2: Element Targeting
**Goal**: Users can capture screenshots of specific DOM elements using CSS selectors or natural language descriptions, with page preparation controls
**Depends on**: Phase 1
**Requirements**: ELEM-01, ELEM-02, ELEM-03, ELEM-04, ELEM-05, PREP-01, PREP-02, PREP-03
**Success Criteria** (what must be TRUE):
  1. User can capture a screenshot of a specific element by CSS selector, and the result shows only that element (with optional padding)
  2. User can describe an element in natural language, and the inspect_page tool returns enough DOM context for Claude to identify the correct selector
  3. User can inject custom CSS or JavaScript before capture to modify page appearance (e.g., hide cookie banners, dismiss modals)
  4. User can capture an element with a transparent background instead of a white fill
**Plans**: TBD

Plans:
- [ ] 02-01: TBD
- [ ] 02-02: TBD

### Phase 3: Authentication
**Goal**: Users can capture screenshots of pages behind login walls using interactive browser authentication or programmatic session injection
**Depends on**: Phase 1
**Requirements**: AUTH-01, AUTH-02, AUTH-03, AUTH-04
**Success Criteria** (what must be TRUE):
  1. User can open a visible browser window, log in manually to any site, and then capture authenticated pages in headless mode using the same session
  2. User can inject cookies or session tokens programmatically and capture authenticated content without manual login
  3. Authenticated sessions persist across multiple captures within the same MCP server session
  4. No user credentials (passwords, tokens) are stored or logged by the tool -- only browser session state is captured
**Plans**: TBD

Plans:
- [ ] 03-01: TBD
- [ ] 03-02: TBD

### Phase 4: Skill Layer + Display Polish
**Goal**: Claude Code users get a natural language interface via SKILL.md, with display mode controls, device presets, and organized output with batch capture support
**Depends on**: Phase 2, Phase 3
**Requirements**: ARCH-03, VIEW-03, VIEW-04, OUTP-03, OUTP-04, OUTP-05
**Success Criteria** (what must be TRUE):
  1. User can install the Claude Code skill and use natural language to capture screenshots without knowing MCP tool syntax
  2. User can toggle dark or light mode before capture and the screenshot reflects the chosen color scheme
  3. User can select a named device preset (e.g., "iPhone 15") and the capture uses the correct viewport, scale factor, and user agent
  4. Screenshots are organized by default into domain/page folders with human-readable names and timestamps
  5. User can define a batch configuration file (YAML/JSON) and capture multiple URLs/viewports in a single command
**Plans**: TBD

Plans:
- [ ] 04-01: TBD
- [ ] 04-02: TBD

### Phase 5: Cross-Client Compatibility + Quality
**Goal**: The MCP server works standalone in any MCP client (including opencode), with comprehensive tests and documentation for community adoption
**Depends on**: Phase 4
**Requirements**: ARCH-04, ARCH-05, QUAL-01, QUAL-02, QUAL-06
**Success Criteria** (what must be TRUE):
  1. MCP server is fully functional without the Claude Code skill layer -- tool descriptions are self-documenting and usable by any MCP client
  2. opencode can connect to the MCP server and capture screenshots using its configuration format
  3. Test suite covers all capture modes, element targeting, auth flows, and edge cases with passing results
  4. README includes clear setup instructions, integration examples, and troubleshooting guide
**Plans**: TBD

Plans:
- [ ] 05-01: TBD
- [ ] 05-02: TBD

## Progress

**Execution Order:**
Phases execute in numeric order: 1 -> 2 -> 3 -> 4 -> 5

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Core Capture Engine | 1/3 | In Progress|  |
| 2. Element Targeting | 0/2 | Not started | - |
| 3. Authentication | 0/2 | Not started | - |
| 4. Skill Layer + Display Polish | 0/2 | Not started | - |
| 5. Cross-Client Compatibility + Quality | 0/2 | Not started | - |
