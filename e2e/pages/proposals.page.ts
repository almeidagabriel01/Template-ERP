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
}
