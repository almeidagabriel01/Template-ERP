import type { Page, Locator } from "@playwright/test";

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
}
