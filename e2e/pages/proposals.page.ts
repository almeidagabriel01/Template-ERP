import type { Page, Locator } from "@playwright/test";

/**
 * Page Object Model for the proposals list page (/proposals).
 */
export class ProposalsPage {
  readonly page: Page;
  readonly proposalList: Locator;
  readonly newProposalButton: Locator;
  readonly pageHeading: Locator;

  constructor(page: Page) {
    this.page = page;
    // Proposal list items — rows in the list/table
    this.proposalList = page.locator('[data-testid="proposal-item"], [data-testid="proposals-list"] > *');
    // New proposal CTA button
    this.newProposalButton = page.getByRole("button", { name: /nova proposta|new proposal|criar/i });
    this.pageHeading = page.locator('h1, [data-testid="page-heading"]').first();
  }

  async goto(): Promise<void> {
    await this.page.goto("/proposals");
  }

  async isLoaded(): Promise<boolean> {
    await this.page.waitForURL(/proposals/, { timeout: 15000 });
    return true;
  }

  async getProposalCount(): Promise<number> {
    try {
      await this.proposalList.first().waitFor({ state: "visible", timeout: 5000 });
      return await this.proposalList.count();
    } catch {
      return 0;
    }
  }

  async clickNewProposal(): Promise<void> {
    await this.newProposalButton.click();
  }

  async getProposalByTitle(title: string): Promise<Locator> {
    return this.page.locator(`text="${title}"`).first();
  }

  /**
   * Creates a proposal through the full browser UI wizard.
   *
   * For tenant-alpha (niche: automacao_residencial), the wizard has 5 steps:
   * 1. Contato — fills title, client, phone, validUntil
   * 2. Soluções — selects a sistema and ambiente from SearchableSelect dropdowns
   * 3. Pagamento — skipped (no payment options enabled by default)
   * 4. PDF — skipped (default settings)
   * 5. Resumo — clicks "Criar Proposta"
   *
   * Requires seed data: sistema-iluminacao-001 / ambiente-sala-001 for tenant-alpha.
   */
  async createProposal(data: { title: string; clientName: string }): Promise<void> {
    await this.clickNewProposal();
    await this.page.waitForURL(/\/proposals\/new/, { timeout: 15000 });

    // Wait for step 1 (Contato) to be visible
    await this.page.locator('#title').waitFor({ state: "visible", timeout: 15000 });

    // --- Step 1: Contato ---

    // Fill title
    await this.page.locator('#title').fill(data.title);

    // Select client via ClientSelect (input with Portuguese placeholder)
    const clientInput = this.page.getByPlaceholder("Digite ou selecione um cliente...");
    await clientInput.fill(data.clientName);
    // Wait for dropdown and click matching option
    const clientOption = this.page.getByText(data.clientName, { exact: false }).nth(1);
    await clientOption.waitFor({ state: "visible", timeout: 8000 });
    await clientOption.click();

    // Fill phone (required field)
    const phoneInput = this.page.locator('#clientPhone');
    await phoneInput.fill('(11) 99999-9999');

    // Fill validUntil date (required — must be today or future)
    const validUntilInput = this.page.locator('#validUntil');
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 30);
    const yyyy = tomorrow.getFullYear();
    const mm = String(tomorrow.getMonth() + 1).padStart(2, '0');
    const dd = String(tomorrow.getDate()).padStart(2, '0');
    await validUntilInput.fill(`${yyyy}-${mm}-${dd}`);

    // Click "Próximo" to advance to step 2
    await this.page.getByRole("button", { name: /próximo/i }).click();

    // --- Step 2: Soluções (automacao_residencial) ---
    // The SistemaSelector renders two SearchableSelect components.
    // First: select sistema using the "Buscar solução..." search input
    const sistemaSearchInput = this.page.getByPlaceholder("Buscar solução...");
    await sistemaSearchInput.waitFor({ state: "visible", timeout: 10000 });
    await sistemaSearchInput.click();
    await sistemaSearchInput.fill("Iluminação");

    // Wait for option and click it
    const sistemaOption = this.page.getByText("Sistema de Iluminação", { exact: false }).first();
    await sistemaOption.waitFor({ state: "visible", timeout: 8000 });
    await sistemaOption.click();

    // After selecting sistema, ambiente selector becomes enabled
    // Select ambiente using the "Selecione um ambiente..." placeholder
    const ambienteSearchInput = this.page.getByPlaceholder("Selecione um ambiente...");
    await ambienteSearchInput.waitFor({ state: "visible", timeout: 8000 });
    await ambienteSearchInput.click();

    // Wait for the dropdown to show options and pick the first one
    const ambienteOption = this.page.getByText("Sala de Estar", { exact: false }).first();
    await ambienteOption.waitFor({ state: "visible", timeout: 8000 });
    await ambienteOption.click();

    // Wait briefly for the sistema to be added to the proposal
    await this.page.waitForTimeout(500);

    // Click "Próximo" to advance to step 3 (Pagamento)
    await this.page.getByRole("button", { name: /próximo/i }).click();

    // --- Step 3: Pagamento — skip, click Próximo ---
    await this.page.waitForTimeout(300);
    await this.page.getByRole("button", { name: /próximo/i }).click();

    // --- Step 4: PDF — skip, click Próximo ---
    await this.page.waitForTimeout(300);
    await this.page.getByRole("button", { name: /próximo/i }).click();

    // --- Step 5: Resumo — click "Criar Proposta" ---
    await this.page.waitForTimeout(300);
    const submitButton = this.page.getByRole("button", { name: /criar proposta/i });
    await submitButton.waitFor({ state: "visible", timeout: 10000 });
    await submitButton.click();

    // Wait for redirect after save (to edit-pdf or back to proposals)
    await this.page.waitForURL(/(\/proposals\/[^/]+\/edit-pdf|\/proposals)/, {
      timeout: 20000,
    });
  }

  /**
   * Edits an existing proposal by navigating to /proposals/[id].
   * Because proposalId is set, allowClickAhead=true in StepWizard — step indicators are clickable.
   * Modifies only the title field on step 1 and saves.
   */
  async editProposal(proposalId: string, data: { title?: string }): Promise<void> {
    await this.page.goto(`/proposals/${proposalId}`);
    await this.page.waitForURL(new RegExp(`/proposals/${proposalId}`), { timeout: 15000 });

    // Wait for the form to load
    await this.page.locator('#title').waitFor({ state: "visible", timeout: 15000 });

    if (data.title) {
      const titleInput = this.page.locator('#title');
      await titleInput.clear();
      await titleInput.fill(data.title);
    }

    // Navigate to the last step (Resumo — step index 4) using the step indicator.
    // allowClickAhead=true for existing proposals, so clicking the step button works.
    // The step buttons are rendered as <button> elements in the StepIndicator.
    // Step 5 label is "Resumo"
    await this.page.getByRole("button", { name: /resumo/i }).click();

    // Wait for the Resumo step to be active and click "Salvar Proposta"
    const saveButton = this.page.getByRole("button", { name: /salvar proposta/i });
    await saveButton.waitFor({ state: "visible", timeout: 10000 });
    await saveButton.click();

    // Wait for save confirmation (redirect or URL stays on same page with save completed)
    await this.page.waitForURL(/(\/proposals\/[^/]+\/edit-pdf|\/proposals\/[^/]+)/, {
      timeout: 20000,
    });
    // Small wait to allow any success toast/redirect to settle
    await this.page.waitForTimeout(1000);
  }

  /**
   * Deletes a proposal from the list page by title.
   * Finds the row with matching title, clicks the Excluir (delete) button,
   * and confirms the AlertDialog.
   *
   * The delete button (Trash2 icon, title="Excluir") is in the action column.
   * On larger viewports it's a direct button; on smaller screens it's inside a dropdown.
   * Tests run at default Playwright viewport (1280x720) which shows the compact dropdown.
   */
  async deleteProposal(title: string): Promise<void> {
    // Find the row containing the proposal title
    const proposalRow = this.page.locator("tr, [role='row']").filter({
      has: this.page.getByText(title, { exact: false }),
    }).first();

    // Try the direct delete button first (visible on wide viewports > 1700px)
    const directDeleteButton = proposalRow.getByRole("button", { name: /excluir/i });
    const isDirectVisible = await directDeleteButton.isVisible().catch(() => false);

    if (isDirectVisible) {
      await directDeleteButton.click();
    } else {
      // Compact dropdown — click the MoreVertical (three dots) button to open dropdown
      const moreButton = proposalRow.getByRole("button").filter({
        has: this.page.locator('[class*="MoreVertical"], svg'),
      }).last();

      // Fallback: click any button in the row that opens the actions menu
      const actionsButton = proposalRow.locator('button[aria-label], button').last();
      await actionsButton.click();

      // Wait for dropdown and click Excluir option
      const deleteMenuItem = this.page.getByRole("menuitem", { name: /excluir/i });
      await deleteMenuItem.waitFor({ state: "visible", timeout: 5000 });
      await deleteMenuItem.click();
    }

    // Confirm the AlertDialog
    const confirmButton = this.page.getByRole("button", { name: /^excluir$/i });
    await confirmButton.waitFor({ state: "visible", timeout: 8000 });
    await confirmButton.click();

    // Wait for proposal to disappear from the list
    const proposalText = this.page.getByText(title, { exact: false }).first();
    await proposalText.waitFor({ state: "hidden", timeout: 10000 }).catch(() => {
      // Acceptable: item may already be gone before waitFor
    });
  }

  /**
   * Returns the status badge text for a proposal row.
   * Used by PROP-06 assertions.
   */
  async getProposalStatus(title: string): Promise<string> {
    const proposalRow = this.page.locator("tr, [role='row']").filter({
      has: this.page.getByText(title, { exact: false }),
    }).first();

    // Status is shown as a Badge element in the status column
    const statusBadge = proposalRow.locator("span[class*='badge'], [class*='Badge'], span").filter({
      hasText: /rascunho|enviada|aprovada|rejeitada|em aberto|em progresso/i,
    }).first();

    return await statusBadge.textContent() ?? "";
  }
}
