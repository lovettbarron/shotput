---
phase: 2
slug: element-targeting
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-07
---

# Phase 2 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest (latest) |
| **Config file** | package.json `vitest run --reporter=verbose` |
| **Quick run command** | `npx vitest run --reporter=verbose` |
| **Full suite command** | `npx vitest run --reporter=verbose` |
| **Estimated runtime** | ~15 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npx vitest run --reporter=verbose`
- **After every plan wave:** Run `npx vitest run --reporter=verbose`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 15 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 2-01-01 | 01 | 1 | ELEM-01 | integration | `npx vitest run tests/capture.test.ts -t "element" -x` | No - W0 | pending |
| 2-01-02 | 01 | 1 | ELEM-03 | unit+integration | `npx vitest run tests/capture.test.ts -t "padding" -x` | No - W0 | pending |
| 2-01-03 | 01 | 1 | ELEM-04 | integration | `npx vitest run tests/capture.test.ts -t "transparent" -x` | No - W0 | pending |
| 2-01-04 | 01 | 1 | PREP-01 | integration | `npx vitest run tests/capture.test.ts -t "inject CSS" -x` | No - W0 | pending |
| 2-01-05 | 01 | 1 | PREP-02 | integration | `npx vitest run tests/capture.test.ts -t "inject JS" -x` | No - W0 | pending |
| 2-01-06 | 01 | 1 | PREP-03 | integration | `npx vitest run tests/capture.test.ts -t "hide" -x` | No - W0 | pending |
| 2-02-01 | 02 | 1 | ELEM-05 | integration | `npx vitest run tests/server.test.ts -t "inspect" -x` | No - W0 | pending |
| 2-02-02 | 02 | 1 | ELEM-02 | manual-only | N/A (requires Claude reasoning) | N/A | pending |

*Status: pending / green / red / flaky*

---

## Wave 0 Requirements

- [ ] `tests/fixtures/element-page.html` — test page with multiple identifiable elements (id, class, data-testid), varied backgrounds, nested structure
- [ ] `tests/capture.test.ts` — extended tests for element targeting, padding, transparency
- [ ] `tests/inspect.test.ts` — tests for DOM inspection / inspect_page tool
- [ ] `tests/server.test.ts` — extended tests for shotput_inspect tool registration and response format

*Existing vitest infrastructure from Phase 1 covers framework setup.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Natural language element description -> Claude identifies selector | ELEM-02 | Requires Claude reasoning over inspect_page output | 1. Call inspect_page on a complex page 2. Verify output contains enough DOM context for Claude to identify correct selector |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 15s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
