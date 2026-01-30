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

  test("should navigate cells with arrow keys", async ({ page }) => {
    const title = `Test Project ${Date.now()}`;
    await createProject(page, title);

    // Click on Source cell in row 0 to activate it (clicking starts editing)
    const row1SourceCell = page.locator("table tbody tr").first().locator("td").nth(3);
    await row1SourceCell.click();

    // Should be in edit mode - there's an input visible
    await expect(page.getByRole("textbox")).toBeVisible();

    // Press ArrowDown while editing - should save and move to next row (exits edit mode)
    await page.keyboard.press("ArrowDown");

    // After arrow navigation, cell is active but not editing
    // The next cell should have the active ring styling
    const row2SourceCell = page.locator("table tbody tr").nth(1).locator("td").nth(3);
    await expect(row2SourceCell).toHaveClass(/ring-2/);

    // Type to start editing in the new cell - this triggers edit mode
    await page.keyboard.type("Row 2 Via Arrow");
    await page.keyboard.press("Enter");

    // Verify the value was saved in row 1 (second row)
    await expect(row2SourceCell).toContainText("Row 2 Via Arrow");
  });

  test("should navigate up with arrow keys while editing", async ({ page }) => {
    const title = `Test Project ${Date.now()}`;
    await createProject(page, title);

    // Click on Source cell in row 1 (second row) to activate it
    const row2SourceCell = page.locator("table tbody tr").nth(1).locator("td").nth(3);
    await row2SourceCell.click();

    // Should be in edit mode
    await expect(page.getByRole("textbox")).toBeVisible();

    // Press ArrowUp while editing - should save and move to previous row (exits edit mode)
    await page.keyboard.press("ArrowUp");

    // After arrow navigation, cell is active but not editing
    // The row 0 source cell should have the active ring styling
    const row1SourceCell = page.locator("table tbody tr").first().locator("td").nth(3);
    await expect(row1SourceCell).toHaveClass(/ring-2/);

    // Type to start editing in the new cell
    await page.keyboard.type("Row 1 Via Up Arrow");
    await page.keyboard.press("Enter");

    // Verify row 0 has the text
    await expect(row1SourceCell).toContainText("Row 1 Via Up Arrow");
  });
});
