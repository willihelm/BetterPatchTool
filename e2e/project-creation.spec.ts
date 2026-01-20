import { test, expect } from "@playwright/test";

test.describe("Project Creation", () => {
  test("should display the project creation form", async ({ page }) => {
    await page.goto("/projects/new");

    // Check form elements are present
    await expect(page.getByLabel(/Title/i)).toBeVisible();
    await expect(page.getByRole("button", { name: /Create Project/i })).toBeVisible();
  });

  test("should create a new project and navigate to it", async ({ page }) => {
    await page.goto("/projects/new");

    // Fill in the form
    const title = `Test Project ${Date.now()}`;
    await page.getByLabel(/Title/i).fill(title);

    // Fill optional fields if they exist
    const venueField = page.getByLabel(/Venue/i);
    if (await venueField.isVisible()) {
      await venueField.fill("Test Venue");
    }

    // Submit the form
    await page.getByRole("button", { name: /Create Project/i }).click();

    // Should navigate to the project page
    await expect(page).toHaveURL(/\/project\/.+/);

    // Project title should be visible
    await expect(page.getByText(title)).toBeVisible();
  });
});
