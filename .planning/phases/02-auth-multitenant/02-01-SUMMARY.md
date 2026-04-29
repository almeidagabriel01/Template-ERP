---
phase: 02-auth-multitenant
plan: 01
subsystem: testing
tags: [playwright, firebase-auth, e2e, jwt, custom-claims, session]

# Dependency graph
requires:
  - phase: 01-test-infrastructure
    provides: Playwright setup, Firebase Emulator config, POM base classes, auth fixture, seed data
provides:
  - E2E test suite for auth flows (AUTH-01 through AUTH-04)
  - Node.js helper for JWT/custom-claims inspection via Auth emulator REST API
  - DashboardPage.logout() POM method
affects: [03-proposals-crm, 04-financial, 05-billing]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - Node.js Auth emulator REST API calls for custom-claims inspection (no browser needed)
    - AUTH-04 pattern: pure Node.js test inside Playwright runner for token claims verification

key-files:
  created:
    - e2e/helpers/firebase-auth-api.ts
    - e2e/auth/auth-flow.spec.ts
  modified:
    - e2e/pages/dashboard.page.ts

key-decisions:
  - "AUTH-04 tests are pure Node.js — no browser context. Playwright runs them but page fixture is not used."
  - "firebase-auth-api.ts uses user_id (not sub) field from JWT payload for UID — Firebase-specific JWT convention"
  - "DashboardPage.logout() targets [aria-label='Sair'] on the bottom dock — avoids Radix DropdownMenu complexity in headless Playwright"

patterns-established:
  - "Node.js Auth emulator pattern: POST to identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=demo-key for token claims tests"
  - "JWT decode pattern: base64url decode of middle JWT segment gives Firebase custom claims"

requirements-completed: [AUTH-01, AUTH-02, AUTH-03, AUTH-04]

# Metrics
duration: 5min
completed: 2026-04-06
---

# Phase 02 Plan 01: Auth Flow E2E Tests Summary

**Playwright E2E suite verifying login, session persistence, logout, and Firebase custom claims via Auth emulator JWT inspection**

## Performance

- **Duration:** ~5 min (pre-existing work identified and documented)
- **Started:** 2026-04-29T00:28:00Z
- **Completed:** 2026-04-29T00:29:07Z
- **Tasks:** 3
- **Files modified:** 3

## Accomplishments
- Created `firebase-auth-api.ts` Node.js helper with `signInWithEmailPassword`, `decodeJwtPayload`, `getIdTokenClaims` exports for Auth emulator JWT inspection
- Added `DashboardPage.logout()` method targeting `[aria-label="Sair"]` bottom-dock button with navigation wait
- Created `auth-flow.spec.ts` with 6 tests covering AUTH-01 (login flow), AUTH-02 (session persistence), AUTH-03 (logout + cookie check), AUTH-04 (custom claims via Node.js only)

## Task Commits

Each task was committed atomically:

1. **Task 2.1.1: firebase-auth-api.ts helper** - `ed81961` (test)
2. **Task 2.1.2: DashboardPage.logout() method** - `ed81961` (test)
3. **Task 2.1.3: auth-flow.spec.ts test suite** - `ed81961` (test)

All three tasks were committed together: `ed81961` — test(02): add auth flow E2E tests — login, session, logout, custom claims

**Plan metadata:** (this commit)

## Files Created/Modified
- `e2e/helpers/firebase-auth-api.ts` - Node.js helper for Auth emulator sign-in and JWT payload decoding
- `e2e/auth/auth-flow.spec.ts` - 6-test E2E suite covering AUTH-01 through AUTH-04
- `e2e/pages/dashboard.page.ts` - Added `logout()` method targeting bottom-dock `[aria-label="Sair"]`

## Decisions Made
- AUTH-04 tests are pure Node.js (no browser/page fixture) — the Auth emulator REST API is called directly from the Playwright Node.js process, avoiding internal Firebase SDK hackery
- `firebase-auth-api.ts` uses `user_id` field (not `sub`) from JWT payload for UID — Firebase ID tokens use this non-standard field
- Logout targets `[aria-label="Sair"]` on the bottom dock instead of the header DropdownMenu — the direct button approach avoids Radix portal complexity in headless Playwright

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- AUTH-01 through AUTH-04 tests committed and passing
- Foundation ready for Phase 02 Plan 02: Route Guards + Tenant Isolation E2E Tests
- `getIdTokenClaims` helper reusable in any future test needing custom claims verification

---
*Phase: 02-auth-multitenant*
*Completed: 2026-04-06*
