---
phase: 02-element-targeting
plan: 01
subsystem: capture
tags: [playwright, element-screenshot, css-selector, transparency, css-injection, js-injection]

requires:
  - phase: 01-core-capture-engine
    provides: "CaptureParams, captureScreenshot, MCP server with shotput_capture tool"
provides:
  - "Element-level screenshot capture by CSS selector"
  - "Padding around element bounding box"
  - "Transparent background support (omitBackground)"
  - "Page preparation pipeline: CSS injection, JS injection, element hiding"
  - "Updated MCP tool schema with 6 new parameters"
affects: [03-page-inspection, element-targeting]

tech-stack:
  added: []
  patterns: [preparePage pipeline, locator.screenshot for element capture, clip-based padding]

key-files:
  created: [tests/fixtures/element-page.html]
  modified: [src/types.ts, src/capture.ts, src/server.ts, tests/capture.test.ts]

key-decisions:
  - "omitBackground + JPEG auto-switches to PNG with warning (JPEG lacks alpha channel)"
  - "preparePage order: hide elements CSS, then inject CSS, then execute JS"
  - "Element capture with zero padding uses locator.screenshot(); with padding uses page.screenshot({ clip })"
  - "Transparency test requires removing body background via injectCSS since omitBackground only removes default browser background"

patterns-established:
  - "preparePage pipeline: sequential page modifications before screenshot"
  - "Element capture branching: locator.screenshot (no padding) vs page.screenshot+clip (with padding)"

requirements-completed: [ELEM-01, ELEM-03, ELEM-04, PREP-01, PREP-02, PREP-03]

duration: 4min
completed: 2026-03-07
---

# Phase 2 Plan 1: Element Capture & Page Preparation Summary

**Element-level screenshots via CSS selector with padding, transparent backgrounds, and pre-capture page preparation (CSS/JS injection, element hiding)**

## Performance

- **Duration:** 4 min
- **Started:** 2026-03-07T20:56:23Z
- **Completed:** 2026-03-07T21:00:30Z
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments
- Extended CaptureParams with 6 new optional fields for element targeting and page preparation
- Implemented element capture via Playwright locator API with optional padding via bounding box clip
- Added preparePage pipeline with deterministic ordering: hide elements, inject CSS, execute JS
- Updated MCP shotput_capture tool schema with all new parameters
- All 40 tests pass (13 existing capture + 8 new element capture + 19 other)

## Task Commits

Each task was committed atomically:

1. **Task 1: Extend types, add test fixture, write failing tests** - `ae1eafd` (test)
2. **Task 2: Implement element capture, page preparation, update MCP schema** - `586555e` (feat)

## Files Created/Modified
- `src/types.ts` - Extended CaptureParams with selector, padding, omitBackground, injectCSS, injectJS, hideSelectors
- `src/capture.ts` - Added preparePage function and element capture logic with padding support
- `src/server.ts` - Added 6 new Zod fields to shotput_capture tool schema
- `tests/fixtures/element-page.html` - Test fixture with target elements, secondary box, and cookie banner
- `tests/capture.test.ts` - 8 new tests for element capture, padding, transparency, injection, hiding

## Decisions Made
- omitBackground + JPEG format auto-switches to PNG with warning (JPEG has no alpha channel)
- preparePage executes in fixed order: hideSelectors CSS, then injectCSS, then injectJS
- Zero-padding element capture uses locator.screenshot() directly; padding > 0 uses page.screenshot({ clip }) with bounding box math
- Transparency test approach: must remove explicit body background via injectCSS since omitBackground only removes the default browser background, not CSS-set backgrounds

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed transparency test approach**
- **Found during:** Task 2 (GREEN phase verification)
- **Issue:** omitBackground test comparing element screenshots with solid backgrounds produced identical buffers because the element itself has #FF6600 background filling its entire area
- **Fix:** Added injectCSS to remove body background and used padding to expose the transparent area around the element
- **Files modified:** tests/capture.test.ts
- **Verification:** Test passes, buffers correctly differ
- **Committed in:** 586555e (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (1 bug fix)
**Impact on plan:** Test approach adjusted for correctness. No scope change.

## Issues Encountered
None beyond the transparency test adjustment documented above.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Element capture pipeline complete, ready for inspect_page tool (Phase 2, Plan 2)
- All existing tests remain green; no regressions

---
*Phase: 02-element-targeting*
*Completed: 2026-03-07*
