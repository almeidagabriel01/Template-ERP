---
phase: 4
slug: financial-module-e2e
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-04-07
---

# Phase 4 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Playwright (existing — Phase 1–3 infra confirmed) |
| **Config file** | `playwright.config.ts` (root) |
| **Quick run command** | `npx playwright test e2e/financial/ --project=chromium` |
| **Full suite command** | `npm run test:e2e` |
| **Estimated runtime** | ~90 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npx playwright test e2e/financial/ --project=chromium`
- **After every plan wave:** Run `npm run test:e2e`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 90 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 4-01-01 | 01 | 0 | FIN-01, FIN-02, FIN-03 | E2E stub | `npx playwright test e2e/financial/transaction-crud.spec.ts --project=chromium` | ❌ W0 | ⬜ pending |
| 4-01-02 | 01 | 0 | FIN-04, FIN-05 | E2E stub | `npx playwright test e2e/financial/wallet-operations.spec.ts --project=chromium` | ❌ W0 | ⬜ pending |
| 4-01-03 | 01 | 0 | FIN-06 | E2E stub | `npx playwright test e2e/financial/installments.spec.ts --project=chromium` | ❌ W0 | ⬜ pending |
| 4-01-04 | 01 | 0 | FIN-04, FIN-05 | POM | `npx playwright test e2e/financial/wallet-operations.spec.ts --project=chromium` | ❌ W0 | ⬜ pending |
| 4-01-05 | 01 | 1 | FIN-01 | E2E | `npx playwright test e2e/financial/transaction-crud.spec.ts --project=chromium` | ❌ W0 | ⬜ pending |
| 4-01-06 | 01 | 1 | FIN-02 | E2E | `npx playwright test e2e/financial/transaction-crud.spec.ts --project=chromium` | ❌ W0 | ⬜ pending |
| 4-01-07 | 01 | 1 | FIN-03 | E2E | `npx playwright test e2e/financial/transaction-crud.spec.ts --project=chromium` | ❌ W0 | ⬜ pending |
| 4-01-08 | 01 | 2 | FIN-04 | E2E | `npx playwright test e2e/financial/wallet-operations.spec.ts --project=chromium` | ❌ W0 | ⬜ pending |
| 4-01-09 | 01 | 2 | FIN-05 | E2E | `npx playwright test e2e/financial/wallet-operations.spec.ts --project=chromium` | ❌ W0 | ⬜ pending |
| 4-01-10 | 01 | 3 | FIN-06 | E2E Hybrid | `npx playwright test e2e/financial/installments.spec.ts --project=chromium` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `e2e/financial/transaction-crud.spec.ts` — stubs for FIN-01, FIN-02, FIN-03
- [ ] `e2e/financial/wallet-operations.spec.ts` — stubs for FIN-04, FIN-05
- [ ] `e2e/financial/installments.spec.ts` — stub for FIN-06
- [ ] `e2e/pages/wallets.page.ts` — new WalletsPage POM (does not exist yet)
- [ ] Extend `e2e/pages/transactions.page.ts` — add `createTransaction`, `editTransaction`, `deleteTransaction` methods

*Note: All Playwright infrastructure (runner, fixtures, seed, emulators) is confirmed operational from Phase 3 UAT (7/7 tests passed).*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Installment API payload shape | FIN-06 | Field names assumed (A1) — must verify against `transactions.controller.ts` before implementing FIN-06 setup | Read `functions/src/api/controllers/transactions.controller.ts`, confirm `isInstallment`, `installmentCount`, `paymentMode`, `installmentsWallet` field names |
| Sequential installment payment enforcement | FIN-06 | UI toast validation — Playwright can assert toast text but must be manually confirmed once | Run test, attempt to mark installment 2 before 1, verify toast/rejection appears |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 90s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
