import { test, expect } from "@playwright/test";

test.describe("Input Channels", () => {
  // Helper to create a project and navigate to it
  async function createProject(page: import("@playwright/test").Page, title: string) {
    await page.goto("/projects/new");
    await page.getByLabel(/Title/i).fill(title);
    await page.getByRole("button", { name: /Create Project/i }).click();
    await expect(page).toHaveURL(/\/project\/.+/);
  }

  test("should display input channels table with pre-created channels", async ({ page }) => {
    const title = `Test Project ${Date.now()}`;
    await createProject(page, title);

    // Should be on Input Patch List by default
    await expect(page.getByRole("tab", { name: "Input Patch List" })).toHaveAttribute(
      "data-state",
      "active"
    );

    // Project creates 48 channels by default
    await expect(page.locator("table tbody tr")).toHaveCount(48);

    // Find the Add Channel button
    const addButton = page.getByRole("button", { name: /Add Channel/i });
    await expect(addButton).toBeVisible();
  });

  test("should add a new input channel", async ({ page }) => {
    const title = `Test Project ${Date.now()}`;
    await createProject(page, title);

    // Get initial count (48 by default)
    const initialCount = await page.locator("table tbody tr").count();

    // Add a channel
    await page.getByRole("button", { name: /Add Channel/i }).click();

    // Should have one more channel
    await expect(page.locator("table tbody tr")).toHaveCount(initialCount + 1);
  });

  test("should edit a channel source name", async ({ page }) => {
    const title = `Test Project ${Date.now()}`;
    await createProject(page, title);

    // Click on the source cell (4th column, index 3) to edit
    const sourceCell = page.locator("table tbody tr").first().locator("td").nth(3);
    await sourceCell.click();

    // Type a source name and press Enter
    await page.keyboard.type("Kick Drum");
    await page.keyboard.press("Enter");

    // Verify the value was saved
    await expect(page.locator("table tbody tr").first().locator("td").nth(3)).toContainText("Kick Drum");
  });

  test("should navigate cells with keyboard", async ({ page }) => {
    const title = `Test Project ${Date.now()}`;
    await createProject(page, title);

    // Click on the source cell of first row
    const sourceCell = page.locator("table tbody tr").first().locator("td").nth(3);
    await sourceCell.click();

    // Type and press Enter - should move to next row
    await page.keyboard.type("Kick");
    await page.keyboard.press("Enter");

    // The second row's source cell should now be active
    await expect(page.getByRole("textbox")).toBeVisible();
  });
});
