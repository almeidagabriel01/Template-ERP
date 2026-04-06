import type { Page, Locator } from "@playwright/test";

/**
 * Page Object Model for the dashboard page (/dashboard).
 */
export class DashboardPage {
  readonly page: Page;
  // Dashboard-specific element — the main nav or page heading
  readonly dashboardHeading: Locator;
  // Navigation links to other sections
  readonly navLinks: Locator;

  constructor(page: Page) {
    this.page = page;
    // Dashboard is identified by its URL and presence of main content area
    this.dashboardHeading = page.locator('[data-testid="dashboard-heading"], h1, main').first();
    this.navLinks = page.locator('nav a, [role="navigation"] a');
  }

  async goto(): Promise<void> {
    await this.page.goto("/dashboard");
  }

  async isLoaded(): Promise<boolean> {
    await this.page.waitForURL(/dashboard/, { timeout: 15000 });
    return true;
  }

  async getWelcomeText(): Promise<string | null> {
    const heading = this.page.locator("h1, h2").first();
    try {
      await heading.waitFor({ state: "visible", timeout: 5000 });
      return await heading.textContent();
    } catch {
      return null;
    }
  }

  async navigateTo(section: "proposals" | "transactions" | "contacts" | "settings"): Promise<void> {
    const sectionPaths: Record<string, string> = {
      proposals: "/proposals",
      transactions: "/transactions",
      contacts: "/contacts",
      settings: "/settings",
    };
    await this.page.goto(sectionPaths[section]);
  }
}
