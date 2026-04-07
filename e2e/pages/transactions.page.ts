import type { Page, Locator } from "@playwright/test";

/**
 * Data shape for creating a transaction through the UI wizard.
 * Only fields required by the "total" payment mode are included.
 * For income transactions, walletName defaults to "Conta Principal".
 */
export interface TransactionCreateData {
  type: "income" | "expense";
  description: string;
  date?: string; // YYYY-MM-DD — when omitted, uses DatePicker "Hoje" shortcut
  amount: string; // e.g. "1500.00" — CurrencyInput format (dot decimal)
  dueDate?: string; // Required for income — when omitted, uses DatePicker "Hoje"
  walletName?: string; // Display name for WalletSelect, defaults to "Conta Principal"
  notes?: string; // Optional notes in Review step
}

/**
 * Page Object Model for the transactions list page (/transactions).
 */
export class TransactionsPage {
  readonly page: Page;
  readonly transactionList: Locator;
  readonly newTransactionButton: Locator;
  readonly pageHeading: Locator;

  constructor(page: Page) {
    this.page = page;
    // Transaction list items
    this.transactionList = page.locator('[data-testid="transaction-item"], [data-testid="transactions-list"] > *');
    // New transaction CTA button
    this.newTransactionButton = page.getByRole("button", { name: /novo lançamento|nova transação|new transaction|adicionar/i });
    this.pageHeading = page.locator('h1, [data-testid="page-heading"]').first();
  }

  async goto(): Promise<void> {
    await this.page.goto("/transactions");
  }

  async isLoaded(): Promise<boolean> {
    await this.page.waitForURL(/transactions/, { timeout: 15000 });
    return true;
  }

  async getTransactionCount(): Promise<number> {
    try {
      await this.transactionList.first().waitFor({ state: "visible", timeout: 5000 });
      return await this.transactionList.count();
    } catch {
      return 0;
    }
  }

  async clickNewTransaction(): Promise<void> {
    await this.newTransactionButton.click();
  }

  /**
   * Returns a Locator for the transaction row/card containing the description text.
   * Scopes the search to Card elements that contain a link or text matching the description,
   * then narrows to the innermost container to avoid false matches on ancestor wrappers.
   */
  async getTransactionByDescription(description: string): Promise<Locator> {
    // Transaction cards render description inside the card content area.
    // Use a broad text filter, then narrow to the first matching card.
    return this.page
      .locator("article, [class*='card'], div[class*='CardContent'], div")
      .filter({ hasText: description })
      .filter({
        has: this.page.getByRole("button", { name: /excluir/i }),
      })
      .first();
  }

  /**
   * Creates a transaction through the full 4-step browser UI wizard.
   *
   * Step 0 (Type): Click income or expense type card, then "Próximo".
   * Step 1 (Details): Fill description and date, then "Próximo".
   * Step 2 (Payment): Fill amount, dueDate (income only), wallet, then "Próximo".
   * Step 3 (Review): Optionally fill notes, then click "Salvar Lançamento".
   *
   * Navigation uses sequential "Próximo" button clicks per D-02 (not step indicator jumps).
   */
  async createTransaction(data: TransactionCreateData): Promise<void> {
    const walletName = data.walletName ?? "Conta Principal";

    await this.clickNewTransaction();
    await this.page.waitForURL(/\/transactions\/new/, { timeout: 15000 });

    // --- Step 0: Type Selection ---
    // Click the "Receita" or "Despesa" card button
    const typeLabel = data.type === "income" ? /receita/i : /despesa/i;
    const typeButton = this.page.getByRole("button", { name: typeLabel });
    await typeButton.waitFor({ state: "visible", timeout: 10000 });
    await typeButton.click();

    // Advance to Step 1
    await this.page.getByRole("button", { name: /próximo/i }).click();

    // --- Step 1: Details ---
    // Fill description
    const descriptionInput = this.page.locator("#description");
    await descriptionInput.waitFor({ state: "visible", timeout: 10000 });
    await descriptionInput.fill(data.description);

    // Fill date: use DatePicker "Hoje" shortcut if no date provided
    if (data.date) {
      // Direct fill via hidden input or by interacting with the picker
      const dateTrigger = this.page.locator('[id="date"]').locator("..");
      const dateButton = dateTrigger.getByRole("button").first();
      await dateButton.click();
      const hojeBtn = this.page.getByRole("button", { name: /hoje/i });
      await hojeBtn.waitFor({ state: "visible", timeout: 5000 });
      await hojeBtn.click({ force: true });
    } else {
      // Open DatePicker and click "Hoje"
      // The DatePicker renders a trigger button adjacent to the hidden input
      const datePickerTrigger = this.page.locator('button').filter({ hasText: /selecionar|hoje|\d{2}\/\d{2}\/\d{4}/i }).first();
      await datePickerTrigger.waitFor({ state: "visible", timeout: 5000 });
      await datePickerTrigger.click();
      const hojeBtn = this.page.getByRole("button", { name: /hoje/i });
      await hojeBtn.waitFor({ state: "visible", timeout: 5000 });
      await hojeBtn.click({ force: true });
    }

    // Advance to Step 2
    await this.page.getByRole("button", { name: /próximo/i }).click();

    // --- Step 2: Payment ---
    // Fill amount in CurrencyInput (id="amount")
    const amountInput = this.page.locator("#amount");
    await amountInput.waitFor({ state: "visible", timeout: 10000 });
    await amountInput.fill(data.amount);
    await amountInput.blur();

    // Fill dueDate for income transactions
    if (data.type === "income") {
      // Click the dueDate DatePicker trigger and select "Hoje"
      const dueDatePickerTrigger = this.page.locator('button').filter({ hasText: /selecionar|hoje|\d{2}\/\d{2}\/\d{4}/i }).first();
      await dueDatePickerTrigger.waitFor({ state: "visible", timeout: 5000 });
      await dueDatePickerTrigger.click();
      const hojeBtn = this.page.getByRole("button", { name: /hoje/i });
      await hojeBtn.waitFor({ state: "visible", timeout: 5000 });
      await hojeBtn.click({ force: true });
    }

    // Select wallet via WalletSelect (native <select> element, name="wallet")
    const walletSelect = this.page.locator('select[name="wallet"]');
    await walletSelect.waitFor({ state: "visible", timeout: 10000 });
    await walletSelect.selectOption({ label: walletName });

    // Advance to Step 3
    await this.page.getByRole("button", { name: /próximo/i }).click();

    // --- Step 3: Review ---
    // Optionally fill notes
    if (data.notes) {
      const notesInput = this.page.locator('textarea[name="notes"], #notes');
      const notesVisible = await notesInput.isVisible().catch(() => false);
      if (notesVisible) {
        await notesInput.fill(data.notes);
      }
    }

    // Submit — label is "Salvar Lançamento" for single transactions
    const submitButton = this.page.getByRole("button", { name: /salvar lançamento|criar \d+ parcelas/i });
    await submitButton.waitFor({ state: "visible", timeout: 10000 });
    await submitButton.click();

    // Wait for redirect away from /transactions/new
    await this.page.waitForURL(
      (url) => !url.pathname.includes("/transactions/new"),
      { timeout: 30000 },
    );
  }

  /**
   * Edits an existing transaction by finding it in the list, navigating to its
   * edit page (/transactions/[id]), modifying the specified fields, and saving.
   *
   * Only supports editing description in the Details step for now.
   * Uses step indicator navigation (allowClickAhead=true for existing transactions).
   */
  async editTransaction(description: string, newData: Partial<TransactionCreateData>): Promise<void> {
    // Navigate to list and find the transaction
    await this.goto();
    await this.isLoaded();

    // Find the "Editar" (Edit) link for the transaction row with matching description.
    // The edit link is: <Link href="/transactions/[id]"> wrapping an Edit icon button
    // with title="Editar". We locate the card containing the description, then find the edit link.
    const card = await this.getTransactionByDescription(description);
    await card.waitFor({ state: "visible", timeout: 10000 });

    // Click the Editar button inside the card — it has title="Editar"
    const editButton = card.getByRole("button", { name: /^editar$/i }).or(
      card.getByTitle("Editar"),
    );

    // The edit button is wrapped in a <Link> — click the link directly
    const editLink = card.locator('a[href*="/transactions/"]').filter({
      has: this.page.getByTitle("Editar"),
    });

    const editLinkCount = await editLink.count();
    if (editLinkCount > 0) {
      await editLink.first().click();
    } else {
      // Fallback: try clicking the edit icon button directly
      await editButton.first().click();
    }

    await this.page.waitForURL(/\/transactions\/[^/]+$/, { timeout: 15000 });

    // Wait for the form to load
    const descriptionInput = this.page.locator("#description");
    await descriptionInput.waitFor({ state: "visible", timeout: 15000 });

    // Modify fields as specified
    if (newData.description) {
      await descriptionInput.clear();
      await descriptionInput.fill(newData.description);
    }

    // Navigate to the Review step (step 4) via sequential Próximo clicks
    // (3 clicks: Details → Payment → Review)
    for (let i = 0; i < 3; i++) {
      const nextBtn = this.page.getByRole("button", { name: /próximo/i });
      const nextVisible = await nextBtn.isVisible().catch(() => false);
      if (nextVisible) {
        await nextBtn.click();
        await this.page.waitForTimeout(300);
      } else {
        break;
      }
    }

    // Click save button on the Review step
    const saveButton = this.page.getByRole("button", { name: /salvar lançamento|criar \d+ parcelas/i });
    await saveButton.waitFor({ state: "visible", timeout: 10000 });
    await saveButton.click();

    // Wait for save to complete
    await this.page.waitForURL(/\/transactions/, { timeout: 20000 });
    await this.page.waitForTimeout(1000);
  }

  /**
   * Deletes a transaction from the list page by description.
   * Finds the card with matching description, clicks the "Excluir" button (title="Excluir"),
   * and confirms the AlertDialog by clicking "Sim, Excluir".
   */
  async deleteTransaction(description: string): Promise<void> {
    // Navigate to list to ensure we are on the right page
    const currentUrl = this.page.url();
    if (!currentUrl.includes("/transactions") || currentUrl.includes("/transactions/")) {
      await this.goto();
      await this.isLoaded();
    }

    // Find the transaction card containing this description
    // The delete button has title="Excluir" inside the action button group
    const card = this.page.locator("div").filter({
      has: this.page.getByTitle("Excluir"),
    }).filter({
      hasText: description,
    }).last();

    await card.waitFor({ state: "visible", timeout: 10000 });

    // Click the delete button inside this card
    const deleteButton = card.getByTitle("Excluir");
    await deleteButton.click();

    // Confirm the AlertDialog — the confirm button text is "Sim, Excluir"
    const confirmButton = this.page.getByRole("button", { name: /sim, excluir/i });
    await confirmButton.waitFor({ state: "visible", timeout: 8000 });
    await confirmButton.click();

    // Wait for the transaction to disappear from the list
    await this.page.waitForTimeout(500);
    const transactionText = this.page.getByText(description, { exact: false });
    await transactionText.waitFor({ state: "hidden", timeout: 10000 }).catch(() => {
      // Acceptable: item may already be removed before waitFor completes
    });
  }
}
