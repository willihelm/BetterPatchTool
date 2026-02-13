import { test, expect } from "@playwright/test";

test.describe("Dashboard", () => {
  test("should display the dashboard page", async ({ page }) => {
    await page.goto("/dashboard");

    // Check that the header logo is visible
    await expect(page.getByAltText("BetterPatchTool").first()).toBeVisible();
    await expect(page.getByText("My Projects")).toBeVisible();
  });

  test("should have a New Project button", async ({ page }) => {
    await page.goto("/dashboard");

    const newProjectButton = page.getByRole("link", { name: /New Project/i });
    await expect(newProjectButton).toBeVisible();
  });

  test("should navigate to create project page", async ({ page }) => {
    await page.goto("/dashboard");

    await page.getByRole("link", { name: /New Project/i }).click();
    await expect(page).toHaveURL(/\/projects\/new/);
  });
});
