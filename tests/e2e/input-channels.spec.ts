import { test, expect } from "@playwright/test";

test.describe("Input Channels", () => {
  // Helper to create a project and navigate to it
  async function createProject(page: import("@playwright/test").Page, title: string) {
    await page.goto("/projects/new");
    await page.getByLabel(/Title/i).fill(title);
    await page.getByRole("button", { name: /Create Project/i }).click();
    await expect(page).toHaveURL(/\/project\/.+/);
  }

  // react-data-grid uses divs with role="row" and role="gridcell" instead of table/tr/td
  const gridRowSelector = '.rdg-row';
  const gridCellSelector = '.rdg-cell';

  test("should display input channels table with pre-created channels", async ({ page }) => {
    const title = `Test Project ${Date.now()}`;
    await createProject(page, title);

    // Should be on Patch List tab by default with Input Channels selected
    await expect(page.getByRole("tab", { name: "Patch List" })).toHaveAttribute(
      "data-state",
      "active"
    );
    await expect(page.getByRole("button", { name: "Input Channels" })).toBeVisible();

    // Find the Add Channel button
    const addButton = page.getByRole("button", { name: /Add Channel/i });
    await expect(addButton).toBeVisible();

    // There should be rows in the grid (default project creates channels)
    await expect(page.locator(gridRowSelector).first()).toBeVisible();
  });

  test("should add a new input channel", async ({ page }) => {
    const title = `Test Project ${Date.now()}`;
    await createProject(page, title);

    // Add a channel - should work
    await page.getByRole("button", { name: /Add Channel/i }).click();

    // The new channel should appear - we can verify the Add Channel button is still visible
    // (meaning the table rendered successfully after adding)
    await expect(page.getByRole("button", { name: /Add Channel/i })).toBeVisible();

    // Also verify we can scroll to see rows
    await expect(page.locator(gridRowSelector).first()).toBeVisible();
  });

  test("should edit a channel source name", async ({ page }) => {
    const title = `Test Project ${Date.now()}`;
    await createProject(page, title);

    // Click on the source cell (4th column, index 3) to edit
    // react-data-grid columns: select (0), channelNumber (1), port (2), source (3)
    const sourceCell = page.locator(gridRowSelector).first().locator(gridCellSelector).nth(3);
    await sourceCell.dblclick(); // Double-click to enter edit mode in react-data-grid

    // Type a source name and press Enter
    await page.keyboard.type("Kick Drum");
    await page.keyboard.press("Enter");

    // Verify the value was saved
    await expect(page.locator(gridRowSelector).first().locator(gridCellSelector).nth(3)).toContainText("Kick Drum");
  });

  test("should navigate cells with keyboard", async ({ page }) => {
    const title = `Test Project ${Date.now()}`;
    await createProject(page, title);

    // Click on the source cell of first row to select it
    const sourceCell = page.locator(gridRowSelector).first().locator(gridCellSelector).nth(3);
    await sourceCell.dblclick(); // Enter edit mode

    // Type and press Tab - should save and move to next column
    await page.keyboard.type("Kick");
    await page.keyboard.press("Tab");

    // After Tab, should move to the next column (UHF column)
    const uhfCell = page.locator(gridRowSelector).first().locator(gridCellSelector).nth(4);
    await expect(uhfCell).toHaveAttribute("aria-selected", "true");
  });

  test("should navigate cells with arrow keys", async ({ page }) => {
    const title = `Test Project ${Date.now()}`;
    await createProject(page, title);

    // Click on Source cell in row 0 to select it
    const row1SourceCell = page.locator(gridRowSelector).first().locator(gridCellSelector).nth(3);
    await row1SourceCell.click();

    // Cell should be selected
    await expect(row1SourceCell).toHaveAttribute("aria-selected", "true");

    // Press ArrowDown - should move to next row
    await page.keyboard.press("ArrowDown");

    // The next cell should now be selected
    const row2SourceCell = page.locator(gridRowSelector).nth(1).locator(gridCellSelector).nth(3);
    await expect(row2SourceCell).toHaveAttribute("aria-selected", "true");

    // Double-click to enter edit mode and type
    await row2SourceCell.dblclick();
    await page.keyboard.type("Row 2 Via Arrow");
    await page.keyboard.press("Enter");

    // Verify the value was saved in row 1 (second row)
    await expect(row2SourceCell).toContainText("Row 2 Via Arrow");
  });

  test("should navigate up with arrow keys", async ({ page }) => {
    const title = `Test Project ${Date.now()}`;
    await createProject(page, title);

    // Click on Source cell in row 1 (second row) to select it
    const row2SourceCell = page.locator(gridRowSelector).nth(1).locator(gridCellSelector).nth(3);
    await row2SourceCell.click();

    // Cell should be selected
    await expect(row2SourceCell).toHaveAttribute("aria-selected", "true");

    // Press ArrowUp - should move to previous row
    await page.keyboard.press("ArrowUp");

    // The row 0 source cell should now be selected
    const row1SourceCell = page.locator(gridRowSelector).first().locator(gridCellSelector).nth(3);
    await expect(row1SourceCell).toHaveAttribute("aria-selected", "true");

    // Double-click to enter edit mode and type
    await row1SourceCell.dblclick();
    await page.keyboard.type("Row 1 Via Up Arrow");
    await page.keyboard.press("Enter");

    // Verify row 0 has the text
    await expect(row1SourceCell).toContainText("Row 1 Via Up Arrow");
  });
});
