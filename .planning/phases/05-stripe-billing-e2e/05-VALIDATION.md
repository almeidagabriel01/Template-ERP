---
phase: 5
slug: stripe-billing-e2e
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-04-07
---

# Phase 5 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Playwright (E2E) + Vitest/Jest (unit/integration) |
| **Config file** | `playwright.config.ts` (existing) |
| **Quick run command** | `npx playwright test --project=chromium tests/billing/` |
| **Full suite command** | `npx playwright test tests/billing/` |
| **Estimated runtime** | ~90 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npx playwright test --project=chromium tests/billing/`
- **After every plan wave:** Run `npx playwright test tests/billing/`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 120 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 5-01-01 | 01 | 0 | BILL-01 | e2e | `npx playwright test tests/billing/subscription-flow.spec.ts` | ❌ W0 | ⬜ pending |
| 5-01-02 | 01 | 0 | BILL-02 | e2e | `npx playwright test tests/billing/webhook-handling.spec.ts` | ❌ W0 | ⬜ pending |
| 5-01-03 | 01 | 1 | BILL-03 | e2e | `npx playwright test tests/billing/plan-limits.spec.ts` | ❌ W0 | ⬜ pending |
| 5-01-04 | 01 | 1 | BILL-04 | e2e | `npx playwright test tests/billing/plan-enforcement.spec.ts` | ❌ W0 | ⬜ pending |
| 5-01-05 | 01 | 2 | BILL-05 | e2e | `npx playwright test tests/billing/whatsapp-overage.spec.ts` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `tests/billing/subscription-flow.spec.ts` — stubs for BILL-01 (subscribe + plan unlock)
- [ ] `tests/billing/webhook-handling.spec.ts` — stubs for BILL-02 (webhook subscription events)
- [ ] `tests/billing/plan-limits.spec.ts` — stubs for BILL-03 (free-tier resource blocking)
- [ ] `tests/billing/plan-enforcement.spec.ts` — stubs for BILL-04 (plan enforcement via tenant-plan-policy)
- [ ] `tests/billing/whatsapp-overage.spec.ts` — stubs for BILL-05 (overage cron calculation)
- [ ] `tests/billing/fixtures/billing-seed.ts` — shared seed: tenant doc with `plan: "free"`, `tenant_usage` doc, `whatsappUsage` doc
- [ ] `CRON_SECRET` env var set in `.env.test` — required for BILL-05 cron invocation

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Stripe webhook signature verification | BILL-02 | Requires real Stripe CLI or signed payload construction | Use `stripe trigger customer.subscription.created` with Stripe CLI pointing at local emulator |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 120s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
