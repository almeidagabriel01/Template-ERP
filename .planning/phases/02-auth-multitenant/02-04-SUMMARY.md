---
phase: 02-auth-multitenant
plan: "04"
subsystem: auth
tags: [auth, e2e, route-guard, playwright, fix]
dependency_graph:
  requires: [02-03]
  provides: [AUTH-05-closed]
  affects: [e2e/auth/route-guards.spec.ts, src/components/auth/protected-route.tsx]
tech_stack:
  added: []
  patterns: [client-side-redirect-with-params]
key_files:
  created: []
  modified:
    - src/components/auth/protected-route.tsx
    - e2e/auth/route-guards.spec.ts
    - .planning/phases/02-auth-multitenant/02-04-DIAGNOSTIC.md
key_decisions:
  - "[Phase 02-04]: AUTH-05 redirect params stripped by ProtectedRoute client-side router.push('/login') which lacked query params; middleware returns HTTP 200 for App Router shell — client JS layer is the actual redirect mechanism. Fixed router.push to include redirect + redirect_reason params."
metrics:
  duration: "~3 hours (including diagnostic instrumentation, two failed hypothesis tests, Branch C identification)"
  completed: "2026-04-29"
  tasks_completed: 2
  files_modified: 3
---

# Phase 02 Plan 04: AUTH-05 Gap Closure (Redirect Param Strip) Summary

AUTH-05 fully closed: `ProtectedRoute` client-side `router.push("/login")` lacked `redirect` and `redirect_reason` query params — fixed to `router.push(\`/login?redirect=...&redirect_reason=session_expired\`)`. All 5 route-guard tests and full 18-test auth suite now pass.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Instrument failing tests and capture navigation chain | (prior session) | e2e/auth/route-guards.spec.ts, 02-04-DIAGNOSTIC.md |
| 2 | Apply targeted fix based on Task 1 diagnosis (Branch C) | 830d5b19 | protected-route.tsx, route-guards.spec.ts, 02-04-DIAGNOSTIC.md |

## Fix Branch Applied: C — ProtectedRoute client-side redirect lacked params

### Evidence from DIAGNOSTIC.md that justified Branch C

1. **HTTP 200 for /dashboard** — middleware did NOT redirect `/dashboard`. A direct HTTP request with no cookies returned `200 OK` with no `Location` header. No 307 to carry params.

2. **Middleware console.log never printed** — Added `console.log("[MIDDLEWARE-ENTRY]")` at the first line of `middleware()`. It never appeared in server logs when Playwright navigated to `/dashboard`. Middleware not invoked for App Router client-navigated routes.

3. **Security headers on 200 response come from next.config.ts** — Initial assumption that security headers proved middleware was running was wrong. Headers (X-Frame-Options, CSP) come from the `headers()` config in `next.config.ts`, not middleware.

4. **Navigation chain**: `NAV /dashboard → NAV /dashboard → NAV /login` — The double `/dashboard` nav is the login page JS (`useLoginForm` useEffect calling `handleRedirectAfterAuth` which calls `window.location.replace("/dashboard")`) causing a bounce. Middleware fires for the second `/dashboard` request and redirects to `/login` WITHOUT params — because middleware's params were on the FIRST redirect's URL but the browser followed a `window.location.replace` that discarded that URL entirely.

5. **Root cause in source code** — `src/components/auth/protected-route.tsx` line 119 had `router.push("/login")` with no query params. This is the redirect Playwright observes when no `__session` cookie and no Firebase user exists client-side.

### Why Branch A was ruled out

Branch A (clear IndexedDB in beforeEach) was applied empirically and DID NOT fix the tests. Test failure time went from 2.6s to 761ms (faster = less bouncing), but both param assertions still returned null. IDB clearing was retained as test hygiene but is not the root cause.

### Why Branch B was ruled out

Branch B targeted `Content-Type: text/plain` on the middleware 307 redirect. Refuted because there IS no 307 — middleware returns HTTP 200 for `/dashboard`. There is no redirect header to have a wrong Content-Type on.

## Fix Applied

**File:** `src/components/auth/protected-route.tsx`

Changed line ~119 from:
```typescript
router.push("/login");
```

To:
```typescript
router.push(
  `/login?redirect=${encodeURIComponent(pathname)}&redirect_reason=session_expired`,
);
```

This mirrors the middleware's redirect logic (which does set these params) for the client-side path. Both code paths now produce the same redirect URL shape.

## Test Results

```
npx playwright test e2e/auth/route-guards.spec.ts
  5 passed (2.0m)

npx playwright test e2e/auth/
  18 passed (48.9s)
```

Previously: 16 passed / 2 failed (tests 13 and 14 in route-guards.spec.ts)

## Verification Checks

```
grep -c "DIAG-" e2e/auth/route-guards.spec.ts          → 0 (diagnostic removed)
grep -c "framenavigated" e2e/auth/route-guards.spec.ts  → 0
grep -c "console.log" e2e/auth/route-guards.spec.ts     → 0
grep -c 'searchParams.get("redirect")).toBe("/dashboard")' e2e/auth/route-guards.spec.ts → 1
grep -c "test(" e2e/auth/route-guards.spec.ts           → 5
grep -c "indexedDB.deleteDatabase" e2e/auth/route-guards.spec.ts → 1 (test hygiene)
grep -c "Content-Type.*text/plain" middleware.ts         → 3 (unchanged — Branch B not applied)
```

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Diagnostic revealed middleware not involved in /dashboard redirect**
- **Found during:** Task 1 — instrument failing tests
- **Issue:** Plan assumed middleware was redirecting `/dashboard` with a 307. HTTP-level verification showed `200 OK`. The actual redirect mechanism is `ProtectedRoute` client-side JS.
- **Fix:** Applied Branch C instead of Branch A (the plan's pre-diagnosis recommendation). Branch A was empirically tested and refuted before Branch C was applied.
- **Files modified:** `src/components/auth/protected-route.tsx`
- **Commit:** 830d5b19

**2. [Rule 2 - Test hygiene] IDB clearing retained in beforeEach**
- **Found during:** Task 2
- **Issue:** Branch A (IDB clearing) doesn't fix the root cause but does prevent Firebase Auth state from leaking between tests, which is valid test isolation hygiene.
- **Fix:** Retained `indexedDB.deleteDatabase` in `beforeEach` alongside the Branch C application code fix. Not a workaround — a defensive measure.
- **Files modified:** `e2e/auth/route-guards.spec.ts`

## Requirements Completed

- AUTH-05: Route guard redirect params survive to user-visible URL — SATISFIED

## Known Stubs

None.

## Threat Flags

None — no new network endpoints or auth paths introduced. Fix is a client-side `router.push` param addition.

## Self-Check: PASSED

- `src/components/auth/protected-route.tsx` — modified (verified Branch C fix present)
- `e2e/auth/route-guards.spec.ts` — modified (IDB clearing in beforeEach, diagnostic removed)
- `.planning/phases/02-auth-multitenant/02-04-DIAGNOSTIC.md` — updated (Branch C confirmed)
- Commit 830d5b19 — exists in git log
- 18/18 auth suite tests passing
