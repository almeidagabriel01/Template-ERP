---
phase: 01-test-infrastructure
plan: 2
subsystem: test-infrastructure
tags: [lighthouse, performance, security, npm-audit, cors, headers, testing]
dependency_graph:
  requires: []
  provides: [test:performance script, test:security script, Lighthouse CI config, security scan runner]
  affects: [package.json, .gitignore]
tech_stack:
  added: ["@lhci/cli@^0.15.1", "tsx@^4.21.0"]
  patterns: [TypeScript scripts run via tsx, modular check pattern for security scan]
key_files:
  created:
    - e2e/lighthouse/lighthouse.config.ts
    - e2e/lighthouse/run-lighthouse.ts
    - e2e/security/run-security-scan.ts
    - e2e/security/checks/audit-check.ts
    - e2e/security/checks/header-check.ts
    - e2e/security/checks/cors-check.ts
  modified:
    - package.json
    - .gitignore
decisions:
  - Used tsx (not ts-node) for running TypeScript scripts — tsx has faster startup and no extra config needed
  - Security scan gracefully skips header/CORS checks when server is unreachable, allowing npm audit to always run
  - CORS check uses wildcard (*) as a fail condition alongside echo — wildcard CORS is also a misconfiguration
  - Lighthouse config uses filesystem upload target so no LHCI server token is required for local runs
metrics:
  duration: "~15 minutes"
  completed: "2026-04-06T22:46:10Z"
  tasks_completed: 1
  files_created: 6
  files_modified: 2
---

# Phase 1 Plan 2: Lighthouse Performance + Security Scan Scripts Summary

**One-liner:** Lighthouse CI local runner with Core Web Vitals thresholds plus modular security scanner (npm audit + header check + CORS validation) exposed as `test:performance` and `test:security` npm scripts.

## What Was Built

### Performance (INFRA-02)

`npm run test:performance` runs Lighthouse CI against `http://localhost:3000/login`. The script first verifies the dev server is reachable (5s timeout) and exits with a clear instruction message if not. On success it runs `lhci autorun` with the config in `e2e/lighthouse/lighthouse.config.ts` and writes the HTML/JSON report to `lighthouse-report/`.

Core Web Vitals thresholds configured:
- LCP: error if > 4000ms (local; CI will tighten to 2500ms)
- CLS: error if > 0.1
- FCP: warn if > 2500ms
- TBT: warn if > 300ms (FID proxy)

### Security (INFRA-03)

`npm run test:security` runs three independent checks collected by `e2e/security/run-security-scan.ts`:

1. **npm-audit** (`audit-check.ts`) — always runs, parses `npm audit --json` for both frontend and `functions/`. Returns `fail` on any critical, `warn` on any high.
2. **header-check** (`header-check.ts`) — fetches base URL, checks `X-Content-Type-Options: nosniff` (error if missing), `X-Frame-Options` or CSP `frame-ancestors` (error if missing), `Strict-Transport-Security` (warn if missing, expected absent on local HTTP).
3. **cors-check** (`cors-check.ts`) — sends OPTIONS to `/api/backend/health` with `Origin: http://evil-site.com`, fails if `Access-Control-Allow-Origin` echoes the evil origin or is `*`.

Header and CORS checks are auto-skipped with a warning when the dev server is not running, allowing the npm audit check to complete standalone.

Results are written to `security-report/security-scan.json`. Exit code 1 if any check is `fail`, 0 otherwise.

## Verification

```bash
# Verify scripts present
node -e "const pkg = require('./package.json'); console.assert(pkg.scripts['test:performance']); console.assert(pkg.scripts['test:security']); console.log('OK')"

# Run security scan (no server required — npm audit only mode)
npm run test:security
# Expected: npm-audit WARN (9 high frontend, 5 high functions), header/CORS skipped, exit 0
```

## Deviations from Plan

None - plan executed exactly as written.

## Known Stubs

None - all checks are fully wired. The audit-check correctly counts vulnerabilities from real npm audit output.

## Self-Check

Checking created files exist:
- e2e/lighthouse/lighthouse.config.ts: FOUND
- e2e/lighthouse/run-lighthouse.ts: FOUND
- e2e/security/run-security-scan.ts: FOUND
- e2e/security/checks/audit-check.ts: FOUND
- e2e/security/checks/header-check.ts: FOUND
- e2e/security/checks/cors-check.ts: FOUND

Checking commit exists:
- 94c6e5e: FOUND

## Self-Check: PASSED
