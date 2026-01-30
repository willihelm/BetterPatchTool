import { test, expect } from "@playwright/test";

test.describe("Project Workflow", () => {
  // Helper to create a project and navigate to it
  async function createProject(page: import("@playwright/test").Page, title: string) {
    await page.goto("/projects/new");
    await page.getByLabel(/Title/i).fill(title);
    await page.getByRole("button", { name: /Create Project/i }).click();
    await expect(page).toHaveURL(/\/project\/.+/);
  }

  test("should have tabs for different views", async ({ page }) => {
    const title = `Test Project ${Date.now()}`;
    await createProject(page, title);

    // Check that all main tabs are present
    await expect(page.getByRole("tab", { name: "Patch List" })).toBeVisible();
    await expect(page.getByRole("tab", { name: "Patch Matrix" })).toBeVisible();
    await expect(page.getByRole("tab", { name: "Stageboxes" })).toBeVisible();
    await expect(page.getByRole("tab", { name: "IO Devices" })).toBeVisible();
  });

  test("should switch between tabs", async ({ page }) => {
    const title = `Test Project ${Date.now()}`;
    await createProject(page, title);

    // Should start on Patch List tab (default)
    await expect(page.getByRole("tab", { name: "Patch List" })).toHaveAttribute(
      "data-state",
      "active"
    );

    // Switch to Patch Matrix tab
    await page.getByRole("tab", { name: "Patch Matrix" }).click();
    await expect(page.getByRole("tab", { name: "Patch Matrix" })).toHaveAttribute(
      "data-state",
      "active"
    );

    // Switch to IO Devices tab
    await page.getByRole("tab", { name: "IO Devices" }).click();
    await expect(page.getByRole("tab", { name: "IO Devices" })).toHaveAttribute(
      "data-state",
      "active"
    );
  });

  test("should navigate back to dashboard", async ({ page }) => {
    const title = `Test Project ${Date.now()}`;
    await createProject(page, title);

    // Click the back button
    await page.getByRole("link", { name: "" }).first().click();
    await expect(page).toHaveURL(/\/dashboard/);
  });
});
