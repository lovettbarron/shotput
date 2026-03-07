---
phase: 01-core-capture-engine
plan: 02
subsystem: capture
tags: [playwright, chromium, screenshot, browser, auto-scroll, png, jpeg]

# Dependency graph
requires:
  - phase: 01-01
    provides: "TypeScript project, CaptureParams/CaptureResult types, test fixtures"
provides:
  - Browser singleton lifecycle with cleanup signal handlers
  - Auto-scroll for lazy-loaded content
  - Output path resolution with domain-based filename generation
  - Core captureScreenshot pipeline (PNG/JPEG, fullPage/viewport, quality, scale, wait strategies)
affects: [01-03]

# Tech tracking
tech-stack:
  added: []
  patterns: [singleton-browser, context-per-capture, incremental-scroll, timeout-fallback]

key-files:
  created:
    - src/browser.ts
    - src/scroll.ts
    - src/output.ts
    - src/capture.ts
  modified:
    - tests/browser.test.ts
    - tests/scroll.test.ts
    - tests/output.test.ts
    - tests/capture.test.ts

key-decisions:
  - "CaptureResult width/height returns viewport dimensions (not pixel dimensions) regardless of scale factor"
  - "Auto-scroll networkidle wait uses 5s timeout with silent catch to avoid hanging"

patterns-established:
  - "Singleton browser: module-level variable with lazy launch and isConnected() check"
  - "Context-per-capture: new browser context created and closed in finally block"
  - "Timeout fallback: navigation timeout sets warning string instead of throwing"
  - "Stderr logging: all process output to stderr, never stdout (MCP stdio transport)"

requirements-completed: [CAPT-01, CAPT-02, CAPT-03, CAPT-04, CAPT-05, CAPT-06, VIEW-01, VIEW-02, ARCH-02, OUTP-01, OUTP-02]

# Metrics
duration: 3min
completed: 2026-03-07
---

# Phase 1 Plan 02: Core Capture Engine Summary

**Playwright capture pipeline with singleton browser, auto-scroll for lazy content, PNG/JPEG output at configurable viewport/scale, and domain-based filename generation**

## Performance

- **Duration:** 3 min
- **Started:** 2026-03-07T20:06:14Z
- **Completed:** 2026-03-07T20:09:34Z
- **Tasks:** 2
- **Files modified:** 8

## Accomplishments
- Browser singleton launches Chromium once, reuses across captures, cleans up on SIGINT/SIGTERM
- Auto-scroll incrementally scrolls pages to trigger lazy-loaded images, then resets to top
- Output module generates `{domain}_{timestamp}.{ext}` filenames and creates directories recursively
- captureScreenshot handles all modes: fullPage/viewport, PNG/JPEG, quality, scale, wait strategies (networkidle/domcontentloaded/load/fixed delay), autoScroll toggle, and timeout fallback with warning
- 28 tests passing (15 for browser/scroll/output + 13 for capture)

## Task Commits

Each task was committed atomically:

1. **Task 1: Browser lifecycle, auto-scroll, and output modules** - `617b8d7` (test), `107a764` (feat)
2. **Task 2: Core capture pipeline** - `bf12f50` (test), `55bb02f` (feat)

_TDD tasks have two commits each (RED: test, GREEN: feat)_

## Files Created/Modified
- `src/browser.ts` - Singleton Chromium launcher with getBrowser/closeBrowser/registerCleanup
- `src/scroll.ts` - Incremental auto-scroll with 250px steps, 100ms delay, 10s max
- `src/output.ts` - Filename generation (domain-based) and output directory creation
- `src/capture.ts` - Core captureScreenshot pipeline tying browser/scroll/output together
- `tests/browser.test.ts` - 5 tests: singleton, reuse, disconnect, re-launch, signal handlers
- `tests/scroll.test.ts` - 3 tests: scroll reset, lazy image loading, timeout compliance
- `tests/output.test.ts` - 7 tests: filename format, path resolution, directory creation, collision
- `tests/capture.test.ts` - 13 tests: PNG/JPEG, fullPage, quality, scale, wait, autoScroll, output

## Decisions Made
- CaptureResult width/height returns viewport dimensions (not scaled pixel dimensions) -- consistent with what the user requested
- Auto-scroll networkidle wait after scrolling uses 5s timeout with silent catch to prevent hangs on pages with persistent connections

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- All 4 production modules ready for MCP server integration (Plan 03)
- captureScreenshot is the single entry point the MCP tool handler will call
- 28 tests provide regression safety for MCP server development

---
*Phase: 01-core-capture-engine*
*Completed: 2026-03-07*

## Self-Check: PASSED
- All 8 source/test files verified present
- All 4 task commits (617b8d7, 107a764, bf12f50, 55bb02f) verified in git log
