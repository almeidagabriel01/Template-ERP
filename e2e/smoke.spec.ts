import { test, expect } from "./fixtures/auth.fixture";

test("app loads login page", async ({ page }) => {
  await page.goto("/");
  // The app should either show the login page or redirect to it
  await expect(page).toHaveURL(/login/);
  // Expect the email input field to be present on the login form
  await expect(page.locator('input[type="email"]')).toBeVisible();
});

test("authenticated user sees dashboard", async ({ authenticatedPage }) => {
  // After login, the app should redirect to an authenticated route
  await expect(authenticatedPage).toHaveURL(/(dashboard|proposals|transactions|contacts)/);
  // The page should not show the login form anymore
  const emailInput = authenticatedPage.locator('input[type="email"]');
  await expect(emailInput).not.toBeVisible();
});
