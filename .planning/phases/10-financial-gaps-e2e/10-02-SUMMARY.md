---
phase: 10
plan: "02"
subsystem: e2e
tags: [e2e, financial, proposals, sync, FIN-09]
dependency_graph:
  requires: [phase-3-proposal-status-pattern, phase-4-transactions-page-pom]
  provides: [FIN-09-coverage]
  affects: []
tech_stack:
  added: []
  patterns: [api-driven-setup, pom-reuse, defensive-cleanup]
key_files:
  created:
    - e2e/financial/proposal-sync.spec.ts
  modified: []
decisions:
  - "Used timestamp in proposal title to ensure uniqueness and avoid cross-test contamination"
  - "Single reload fallback for stale frontend cache — sync is synchronous so no polling needed"
  - "Cascade deletion check: if proposal delete does not cascade, UI deleteTransaction cleans up"
metrics:
  duration: "~5 minutes"
  completed: "2026-04-09"
  tasks_completed: 1
  files_created: 1
  files_modified: 0
---

# Phase 10 Plan 02: Proposal Approval to Transaction Sync E2E Summary

**One-liner:** Playwright E2E test validating that approving a proposal via the draft→sent→approved API flow triggers `syncApprovedProposalTransactions` and the synced income transaction appears by title match in `/transactions`.

## What Was Implemented

Created `e2e/financial/proposal-sync.spec.ts` (FIN-09) covering the full proposal approval to transaction sync flow:

1. Creates a unique draft proposal via API using `PROPOSAL_ALPHA_DRAFT` seed data fields
2. Transitions draft → sent via PUT API (controller requires this intermediate step)
3. Transitions sent → approved via PUT API — triggers `syncApprovedProposalTransactions` synchronously
4. Navigates to `/transactions` and verifies the synced transaction is visible using `TransactionsPage.getTransactionByDescription()` with the exact proposal title
5. Cleans up: deletes the proposal via API, then conditionally deletes the synced transaction via UI if cascade did not occur

## Files Created

- `e2e/financial/proposal-sync.spec.ts` — FIN-09 spec, 1 test in 1 describe block

## Deviations from Plan

None — plan executed exactly as written. The spec matches the code provided in the plan exactly, using the confirmed `normalizeProposalTransactionTitle()` behavior (trim-only, no case change) and the `TransactionsPage` POM methods already available.

## Commits

| Hash | Message |
|------|---------|
| 195f8cd | test(e2e): add FIN-09 proposal approval to transaction sync E2E test |

## Self-Check: PASSED

- `e2e/financial/proposal-sync.spec.ts` exists: FOUND
- Commit `195f8cd` exists: FOUND
