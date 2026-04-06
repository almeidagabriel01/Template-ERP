import { test as base } from "@playwright/test";
import { LoginPage } from "../pages/login.page";
import { DashboardPage } from "../pages/dashboard.page";
import { ProposalsPage } from "../pages/proposals.page";
import { TransactionsPage } from "../pages/transactions.page";

interface PageFixtures {
  loginPage: LoginPage;
  dashboardPage: DashboardPage;
  proposalsPage: ProposalsPage;
  transactionsPage: TransactionsPage;
}

/**
 * Base test fixture providing typed Page Object Model instances.
 * Extend this for all e2e tests to get automatic POM instances.
 */
export const test = base.extend<PageFixtures>({
  loginPage: async ({ page }, use) => {
    await use(new LoginPage(page));
  },
  dashboardPage: async ({ page }, use) => {
    await use(new DashboardPage(page));
  },
  proposalsPage: async ({ page }, use) => {
    await use(new ProposalsPage(page));
  },
  transactionsPage: async ({ page }, use) => {
    await use(new TransactionsPage(page));
  },
});

export { expect } from "@playwright/test";
