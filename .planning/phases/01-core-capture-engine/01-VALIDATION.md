---
phase: 1
slug: core-capture-engine
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-07
---

# Phase 1 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest (latest stable) |
| **Config file** | `vitest.config.ts` — Wave 0 installs |
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
| 01-01-01 | 01 | 1 | CAPT-01 | integration | `npx vitest run tests/capture.test.ts -t "full page"` | ❌ W0 | ⬜ pending |
| 01-01-02 | 01 | 1 | CAPT-02 | integration | `npx vitest run tests/capture.test.ts -t "viewport"` | ❌ W0 | ⬜ pending |
| 01-01-03 | 01 | 1 | CAPT-03 | unit | `npx vitest run tests/capture.test.ts -t "format"` | ❌ W0 | ⬜ pending |
| 01-01-04 | 01 | 1 | CAPT-04 | unit | `npx vitest run tests/capture.test.ts -t "quality"` | ❌ W0 | ⬜ pending |
| 01-01-05 | 01 | 1 | CAPT-05 | integration | `npx vitest run tests/scroll.test.ts` | ❌ W0 | ⬜ pending |
| 01-01-06 | 01 | 1 | CAPT-06 | integration | `npx vitest run tests/capture.test.ts -t "wait"` | ❌ W0 | ⬜ pending |
| 01-01-07 | 01 | 1 | VIEW-01 | integration | `npx vitest run tests/capture.test.ts -t "viewport dimensions"` | ❌ W0 | ⬜ pending |
| 01-01-08 | 01 | 1 | VIEW-02 | integration | `npx vitest run tests/capture.test.ts -t "scale"` | ❌ W0 | ⬜ pending |
| 01-01-09 | 01 | 1 | ARCH-01 | integration | `npx vitest run tests/server.test.ts` | ❌ W0 | ⬜ pending |
| 01-01-10 | 01 | 1 | ARCH-02 | integration | `npx vitest run tests/browser.test.ts` | ❌ W0 | ⬜ pending |
| 01-01-11 | 01 | 1 | OUTP-01 | unit | `npx vitest run tests/output.test.ts -t "directory"` | ❌ W0 | ⬜ pending |
| 01-01-12 | 01 | 1 | OUTP-02 | unit | `npx vitest run tests/output.test.ts -t "filename"` | ❌ W0 | ⬜ pending |
| 01-01-13 | 01 | 1 | QUAL-03 | smoke | `test -f LICENSE` | ❌ W0 | ⬜ pending |
| 01-01-14 | 01 | 1 | QUAL-04 | smoke | `npx license-checker --onlyAllow 'MIT;Apache-2.0;ISC;BSD-2-Clause;BSD-3-Clause;0BSD;CC0-1.0;Unlicense'` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `vitest.config.ts` — vitest configuration
- [ ] `tests/capture.test.ts` — stubs for CAPT-01 through CAPT-06, VIEW-01, VIEW-02
- [ ] `tests/scroll.test.ts` — stubs for CAPT-05 auto-scroll behavior
- [ ] `tests/server.test.ts` — stubs for ARCH-01 MCP server integration
- [ ] `tests/browser.test.ts` — stubs for ARCH-02 lifecycle/cleanup
- [ ] `tests/output.test.ts` — stubs for OUTP-01, OUTP-02 file output
- [ ] `npm install -D vitest` — framework install
- [ ] Test HTML fixtures — static HTML pages for predictable screenshot testing

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| No restrictive bundled assets | QUAL-05 | Requires visual audit of dist/ output | Inspect `dist/` for any non-MIT/permissive bundled assets |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 15s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
