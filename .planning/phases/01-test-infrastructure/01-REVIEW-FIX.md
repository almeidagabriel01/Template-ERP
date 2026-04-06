---
phase: 01-test-infrastructure
fixed_at: 2026-04-06T00:00:00Z
review_path: .planning/phases/01-test-infrastructure/01-REVIEW.md
iteration: 1
findings_in_scope: 7
fixed: 7
skipped: 0
status: all_fixed
---

# Phase 01: Code Review Fix Report

**Fixed at:** 2026-04-06T00:00:00Z
**Source review:** .planning/phases/01-test-infrastructure/01-REVIEW.md
**Iteration:** 1

**Summary:**
- Findings in scope: 7
- Fixed: 7
- Skipped: 0

## Fixed Issues

### CR-01: `.env.test` committed to the repository despite `.env*` gitignore rule

**Files modified:** `.gitignore`, `.github/workflows/test-suite.yml`
**Commit:** c4d6bf8
**Applied fix:** Added `!.env.test` exception to `.gitignore` after `!.env.example`. Added `FIREBASE_STORAGE_EMULATOR_HOST: '127.0.0.1:9199'` to the E2E job env block in the CI workflow, bringing it in line with `.env.test`.

---

### WR-01: Emulator process orphaned on startup failure; `unref()` never called

**Files modified:** `e2e/global-setup.ts`
**Commit:** 2adbaa0
**Applied fix:** Called `emulatorProcess.unref()` immediately after writing the PID file. Wrapped `waitForEmulators()` in a try/catch that calls `emulatorProcess.kill()` before rethrowing, so orphaned processes are cleaned up on timeout or startup failure. (This commit also applies WR-04 — see below.)

---

### WR-02: `webServer.env` in `playwright.config.ts` missing emulator host vars

**Files modified:** `playwright.config.ts`
**Commit:** 1c12550
**Applied fix:** Added `FIRESTORE_EMULATOR_HOST`, `FIREBASE_AUTH_EMULATOR_HOST`, and `FIREBASE_STORAGE_EMULATOR_HOST` to the `webServer.env` block so the Next.js dev server process inherits emulator addresses. (This commit also applies WR-06 — see below.)

---

### WR-03: LHCI cannot load a `.ts` config file

**Files modified:** `e2e/lighthouse/lighthouse.config.js` (new), `e2e/lighthouse/run-lighthouse.ts`, `.github/workflows/test-suite.yml`
**Commit:** f8582a2
**Applied fix:** Created `e2e/lighthouse/lighthouse.config.js` as a CommonJS `module.exports` equivalent of the original TypeScript config. Deleted `e2e/lighthouse/lighthouse.config.ts`. Updated the `--config=` flag in both `run-lighthouse.ts` and the CI workflow `lhci autorun` step to reference the `.js` file.

---

### WR-04: `clearAll()` never called before `seedAll()` in global-setup

**Files modified:** `e2e/global-setup.ts`
**Commit:** 2adbaa0
**Applied fix:** Added `clearAll` to the dynamic import from `./seed/seed-factory` and called `await clearAll()` before `await seedAll()` in `globalSetup()`. This ensures Firestore and Auth state is reset before each test run, preventing state leakage between re-runs on the same emulator session.

---

### WR-05: `audit-check.ts` silently treats JSON parse failure as zero vulnerabilities

**Files modified:** `e2e/security/checks/audit-check.ts`
**Commit:** 1e7d92c
**Applied fix:** Added an error guard at the top of `runAuditCheck()`: if either `frontend.error` or `functions.error` is set, the function returns `{ status: 'warn', details: 'Audit could not complete: ...', highCount: 0, criticalCount: 0 }` immediately instead of silently reporting a clean result.

---

### WR-06: Dead `use.env` block in `playwright.config.ts`

**Files modified:** `playwright.config.ts`
**Commit:** 1c12550
**Applied fix:** Removed the `use.env` block containing `FIRESTORE_EMULATOR_HOST` and `FIREBASE_AUTH_EMULATOR_HOST`. These vars do not configure the browser-side Firebase client SDK and had no effect. The correct locations — `global-setup.ts` for Admin SDK and `webServer.env` for server-side Next.js code — are now the only places these vars are set.

---

_Fixed: 2026-04-06T00:00:00Z_
_Fixer: Claude (gsd-code-fixer)_
_Iteration: 1_
