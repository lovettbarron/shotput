---
phase: 3
slug: authentication
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-08
---

# Phase 3 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest (latest) |
| **Config file** | `vitest.config.ts` |
| **Quick run command** | `npx vitest run tests/auth.test.ts -x` |
| **Full suite command** | `npx vitest run --reporter=verbose` |
| **Estimated runtime** | ~5 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npx vitest run tests/auth.test.ts -x`
- **After every plan wave:** Run `npx vitest run --reporter=verbose`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 5 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 03-01-01 | 01 | 1 | AUTH-01 | integration | `npx vitest run tests/auth.test.ts -t "interactive login" -x` | ❌ W0 | ⬜ pending |
| 03-01-02 | 01 | 1 | AUTH-02 | unit | `npx vitest run tests/auth.test.ts -t "cookie injection" -x` | ❌ W0 | ⬜ pending |
| 03-01-03 | 01 | 1 | AUTH-03 | integration | `npx vitest run tests/auth.test.ts -t "session persistence" -x` | ❌ W0 | ⬜ pending |
| 03-01-04 | 01 | 1 | AUTH-04 | unit | `npx vitest run tests/auth.test.ts -t "no credentials" -x` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `tests/auth.test.ts` — stubs for AUTH-01 through AUTH-04
- [ ] Test fixture: local HTTP server with login form for testing interactive login flow

*If none: "Existing infrastructure covers all phase requirements."*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Interactive browser login UX | AUTH-01 | Requires visual browser interaction | Open headed browser, log in to test site, close browser, verify storageState captured |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 5s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
