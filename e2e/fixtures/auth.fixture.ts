import type { Page } from "@playwright/test";
import { test as base, expect } from "./base.fixture";
import { LoginPage } from "../pages/login.page";
import { USER_ADMIN_ALPHA, USER_ADMIN_BETA } from "../seed/data/users";

interface AuthFixtures {
  /** Pre-authenticated page as tenant-alpha admin (admin@alpha.test) */
  authenticatedPage: Page;
  /** Pre-authenticated page as tenant-beta admin (admin@beta.test) */
  authenticatedAsBeta: Page;
}

/**
 * Auth fixture that provides pre-authenticated browser contexts.
 * Uses LoginPage to log in seeded users before handing the page to tests.
 */
export const test = base.extend<AuthFixtures>({
  authenticatedPage: async ({ page }, use) => {
    const loginPage = new LoginPage(page);
    await loginPage.goto();
    await loginPage.login(USER_ADMIN_ALPHA.email, USER_ADMIN_ALPHA.password);

    // Wait for redirect to an authenticated route (dashboard or any main route)
    await page.waitForURL(/(dashboard|proposals|transactions|contacts)/, { timeout: 15000 });

    await use(page);
  },

  authenticatedAsBeta: async ({ page }, use) => {
    const loginPage = new LoginPage(page);
    await loginPage.goto();
    await loginPage.login(USER_ADMIN_BETA.email, USER_ADMIN_BETA.password);

    // Wait for redirect to an authenticated route
    await page.waitForURL(/(dashboard|proposals|transactions|contacts)/, { timeout: 15000 });

    await use(page);
  },
});

export { expect };
