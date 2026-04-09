---
phase: 10
plan: "01"
subsystem: e2e-tests
tags: [e2e, financial, transactions, installments, playwright]
dependency_graph:
  requires: [phase-4-infrastructure, FIN-01, FIN-02, FIN-03, FIN-06]
  provides: [FIN-07, FIN-08]
  affects: [e2e/financial/transaction-crud.spec.ts, e2e/financial/installments.spec.ts]
tech_stack:
  added: []
  patterns: [create-then-delete isolation, hybrid-api-ui, portal-dropdown-selection, sequential-installment-payment]
key_files:
  created: []
  modified:
    - e2e/financial/transaction-crud.spec.ts
    - e2e/financial/installments.spec.ts
decisions:
  - FIN-07 expense tests mirror FIN-01/02/03 structure exactly; no new POM methods needed since createTransaction already accepts type:'expense'
  - FIN-08 reuses FIN-06 hybrid API+UI pattern with one added assertion (installment 3/3 stays Pendente)
metrics:
  duration: "~5 minutes"
  completed: "2026-04-09"
  tasks_completed: 2
  files_modified: 2
---

# Phase 10 Plan 01: Expense CRUD + Selective Installment Payment E2E Summary

Added E2E coverage for FIN-07 (expense transaction CRUD) and FIN-08 (selective installment payment) using existing Playwright infrastructure from Phase 4.

## What Was Implemented

### FIN-07: Expense Transaction CRUD (3 describe blocks in transaction-crud.spec.ts)

- **FIN-07-A**: Creates an expense transaction via the UI wizard and asserts it appears in the list. Uses `createTransaction({ type: 'expense', ... })` — the POM skips `dueDate` and `clientName` fields for expenses automatically.
- **FIN-07-B**: Creates an expense transaction, edits its description via `editTransaction()`, navigates back, and asserts the updated description is visible.
- **FIN-07-C**: Creates an expense transaction, deletes it via `deleteTransaction()`, and asserts it is no longer visible in the list.

All three follow the create-then-delete isolation pattern (D-03): each test creates its own data and cleans up after itself.

### FIN-08: Selective Installment Payment (1 describe block in installments.spec.ts)

Reuses the FIN-06 hybrid API+UI pattern:
1. Creates a 3-installment income group via `POST /api/backend/v1/transactions` with `isInstallment: true, installmentCount: 3`.
2. Navigates to `/transactions`, switches to "Agrupados" view, expands the group card.
3. Marks installment 1/3 as "Pago" via the portal dropdown (sequential order enforced).
4. Marks installment 2/3 as "Pago" via the portal dropdown.
5. **Core FIN-08 assertion**: asserts installment 3/3 still shows "Pendente" — verifying selective payment does not cascade to unpaid installments.
6. Cleans up via `DELETE /api/backend/v1/transactions/:id`.

## Files Modified

- `e2e/financial/transaction-crud.spec.ts` — appended FIN-07-A, FIN-07-B, FIN-07-C describe blocks after FIN-03
- `e2e/financial/installments.spec.ts` — appended FIN-08 describe block after FIN-06

## Deviations from Plan

None — plan executed exactly as written.

## Self-Check: PASSED

- `e2e/financial/transaction-crud.spec.ts` — modified (confirmed by edit result)
- `e2e/financial/installments.spec.ts` — modified (confirmed by edit result)
- Commit `b300bc3` — verified by git output
