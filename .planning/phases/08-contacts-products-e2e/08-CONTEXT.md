# Phase 8 Context: Contacts & Products CRUD E2E

**Phase:** 8 — Contacts & Products CRUD E2E
**Requirements:** CONT-01, CONT-02, CONT-03, PROD-01, PROD-02, PROD-03
**Created:** 2026-04-08

---

## Decisions

### Test environment
- Tenant: `tenant-alpha` (automacao_residencial niche) — already provisioned in seed data
- No new seed fixture data needed; create-via-API pattern handles delete isolation

### Contacts module
- Firestore collection: `clients` (NOT `contacts` — the frontend calls them "contacts" but the backend collection is `clients`)
- Controller: `functions/src/api/controllers/clients.controller.ts`
- Routes: `/contacts` (list), `/contacts/new` (create), `/contacts/[id]` (edit)
- Form: 3-step wizard
  - Step 1 — Informações: `types` (toggle buttons), `name`, `email`, `phone`
  - Step 2 — Endereço: `address` (optional)
  - Step 3 — Finalizar: `notes` (optional)
- Contact type for tests: **"Cliente" only** (single type, most common case)
- Required fields: `name`, `phone`, `types` (at least one selected)
- Existing seed contacts for tenant-alpha: CONTACT_ALPHA_001 through CONTACT_ALPHA_004 — may be referenced in proposals, do NOT use for delete tests

### Products module
- Firestore collection: `products`
- Controller: `functions/src/api/controllers/products.controller.ts`
- Routes: `/products` (list), `/products/new` (create), `/products/[id]` (edit)
- Form: 4-step wizard
  - Step 1 — Informações: `name`, `description`, `category`, `manufacturer`, `stock`/`inventoryValue`
  - Step 2 — Preço: `price`, `markup`
  - Step 3 — Imagens: **skip entirely** — click Next without uploading; tests focus on data correctness, not file handling
  - Step 4 — Resumo: summary display, submit
- Niche: automacao_residencial — no curtain pricing tiers, no pricingMode dropdown; simpler pricing form
- Required fields: `name`, `category`, `price` (> 0)
- Existing seed product: `product-sensor-001` — do NOT use for delete tests

### Delete isolation strategy
- **Create via API in beforeEach** — same pattern as FIN-06 installment group
- POST to `/api/backend/v1/clients` (contact) or `/api/backend/v1/products` (product) in test setup
- Then delete via UI in the test
- This avoids dependency on seed records that may be linked to proposals (deletion is blocked if linked)

### Delete UI pattern
- Both contacts and products: delete button (trash icon) in the "Ações" column of the list table
- Triggers an AlertDialog
- Contacts dialog title: "Excluir Cliente"
- Products dialog title: "Excluir Produto"
- Confirmation button text: "Excluir"
- Loading state text: "Excluindo..."

### POM structure
- New POM files: `e2e/pages/contacts.page.ts` and `e2e/pages/products.page.ts`
- Follow existing pattern from `proposals.page.ts` / `transactions.page.ts`: class-based, locators as properties, methods for interactions
- `isLoaded()` should check URL pathname (e.g. `/contacts`, `/products`) — same pattern as existing POMs

### Test file locations
- `e2e/contacts/contact-crud.spec.ts`
- `e2e/products/product-crud.spec.ts`

### Existing patterns to reuse
- `authenticatedPage` fixture from Playwright config — use for all CRUD tests
- Multi-step wizard navigation: `allowClickAhead` pattern from Phase 3 (editProposal POM) for navigating to later steps in edit flows
- API-based record creation in beforeEach: follow FIN-06 installment group pattern from `e2e/financial/installments.spec.ts`
- Radix DropdownMenuItem: use text filter (NOT `getByRole('menuitem')`) — items render as generic divs

---

## Out of Scope for Phase 8
- Image upload testing — deferred (skip the image step)
- Fornecedor contact type — deferred
- Permission/role-based access (canCreate/canEdit/canDelete guards) — deferred
- Contacts search/filter UI — deferred
- Products stock editing (StockEditableCell) — deferred
- Cortinas niche product form — deferred
