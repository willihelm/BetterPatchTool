# Testing Patterns

**Analysis Date:** 2026-01-21

## Test Framework

**Runner:**
- Vitest 4.0.17 (primary test runner)
- Playwright 1.57.0 (E2E testing)
- Config: `vitest.config.ts` and `playwright.config.ts`

**Assertion Library:**
- Vitest built-in assertions and expect API
- Playwright built-in assertions (`expect()` from `@playwright/test`)
- Testing Library for DOM assertions
- Jest-DOM matchers via `@testing-library/jest-dom`

**Run Commands:**
```bash
bun run test              # Run all tests (unit + Convex) in watch mode
bun run test:run         # Run all tests once (CI mode)
bun run test:e2e         # Run E2E tests headless
bun run test:e2e:ui      # Run E2E tests with UI
```

## Test File Organization

**Location:**
- Unit tests: `tests/` directory parallel to `src/`
- Convex tests: Colocated in `convex/` directory with source files
- E2E tests: `e2e/` directory at root level

**Naming:**
- Unit tests: `<module>.test.ts` (e.g., `string-utils.test.ts`, `date-utils.test.ts`)
- Convex tests: `<module>.test.ts` (e.g., `projects.test.ts`, `inputChannels.test.ts`)
- E2E tests: `<feature>.spec.ts` (e.g., `dashboard.spec.ts`, `input-channels.spec.ts`)

**Structure:**
```
tests/
├── lib/                      # Unit tests for utilities
│   ├── string-utils.test.ts  # Test incrementTrailingNumber
│   └── date-utils.test.ts    # Test formatDistanceToNow, formatDate
└── setup.ts                  # Vitest setup (jest-dom)

convex/
├── inputChannels.test.ts     # Input channel CRUD, move, insert
├── outputChannels.test.ts    # Output channel CRUD, move
└── projects.test.ts          # Project CRUD, duplicate, archive

e2e/
├── dashboard.spec.ts         # Dashboard navigation
├── project-creation.spec.ts  # Create project flow
├── project-workflow.spec.ts  # Tab navigation, views
└── input-channels.spec.ts    # Channel editing, keyboard nav
```

## Test Structure

**Suite Organization:**
```typescript
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

describe("feature name", () => {
  beforeEach(() => {
    // Setup before each test
    vi.useFakeTimers();
  });

  afterEach(() => {
    // Cleanup after each test
    vi.useRealTimers();
  });

  describe("sub-feature", () => {
    it("should do something specific", () => {
      // Test implementation
    });
  });
});
```

**Patterns:**
- Use `describe()` for grouping related tests
- Nested `describe()` blocks for organizing by functionality
- Flat test structure within describe blocks - typically 5-15 tests per block
- Setup in `beforeEach()`, teardown in `afterEach()`
- Import `describe`, `it`, `expect`, `vi` from "vitest"

## Test Structure Examples

**Unit Test Pattern (Utility Functions):**
```typescript
// From tests/lib/date-utils.test.ts
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { formatDistanceToNow, formatDate } from "@/lib/date-utils";

describe("formatDistanceToNow", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2025-01-15T12:00:00.000Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should return "just now" for timestamps less than a minute ago', () => {
    const now = Date.now();
    expect(formatDistanceToNow(now)).toBe("just now");
    expect(formatDistanceToNow(now - 30000)).toBe("just now");
  });

  it("should return minutes ago for timestamps less than an hour ago", () => {
    const now = Date.now();
    expect(formatDistanceToNow(now - 60000)).toBe("1 minute ago");
    expect(formatDistanceToNow(now - 120000)).toBe("2 minutes ago");
  });
});
```

**Convex Test Pattern:**
```typescript
// From convex/projects.test.ts
/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { describe, it, expect } from "vitest";
import { api } from "./_generated/api";
import schema from "./schema";

const modules = import.meta.glob("./**/*.ts");

describe("projects", () => {
  describe("create", () => {
    it("should create a new project with default channels", async () => {
      const t = convexTest(schema, modules);

      const projectId = await t.mutation(api.projects.create, {
        title: "Test Concert",
        ownerId: "test-user",
      });

      expect(projectId).toBeDefined();

      const project = await t.query(api.projects.get, { projectId });
      expect(project?.title).toBe("Test Concert");
      expect(project?.ownerId).toBe("test-user");
    });
  });
});
```

**E2E Test Pattern:**
```typescript
// From e2e/dashboard.spec.ts
import { test, expect } from "@playwright/test";

test.describe("Dashboard", () => {
  test("should display the dashboard page", async ({ page }) => {
    await page.goto("/dashboard");

    // Check that the header is visible
    await expect(page.getByRole("heading", { name: "BetterPatchTool" })).toBeVisible();
    await expect(page.getByText("Dashboard")).toBeVisible();
  });

  test("should navigate to create project page", async ({ page }) => {
    await page.goto("/dashboard");

    await page.getByRole("link", { name: /New Project/i }).click();
    await expect(page).toHaveURL(/\/projects\/new/);
  });
});
```

## Mocking

**Framework:** Vitest native `vi` module for mocking
- `vi.useFakeTimers()` / `vi.useRealTimers()` for time mocking
- `vi.fn()` for function mocking (not seen but available)

**Patterns:**
```typescript
// Time mocking for date-based tests
beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2025-01-15T12:00:00.000Z"));
});

afterEach(() => {
  vi.useRealTimers();
});
```

**What to Mock:**
- System time in date/timestamp tests
- External API calls in future tests (not currently mocked)
- Database access is handled by convex-test framework

**What NOT to Mock:**
- Database operations - use convex-test framework instead
- Utility functions - test them directly
- UI components in component tests - render them
- Routes and navigation in E2E tests - test actual browser behavior

## Fixtures and Factories

**Test Data:**
```typescript
// From convex/inputChannels.test.ts
async function setupProject(t: ReturnType<typeof convexTest>) {
  // Create a project first
  const projectId = await t.run(async (ctx) => {
    return await ctx.db.insert("projects", {
      title: "Test Project",
      ownerId: "test-user",
      collaborators: [],
      isArchived: false,
    });
  });
  return projectId;
}
```

**Location:**
- Helper functions defined at top of test files
- Helper functions prefixed with verb: `setupProject()`, `createProject()`
- Used in multiple `it()` blocks within same test suite

**E2E Fixtures:**
```typescript
// From e2e/input-channels.spec.ts
async function createProject(page: import("@playwright/test").Page, title: string) {
  await page.goto("/projects/new");
  await page.getByLabel(/Title/i).fill(title);
  await page.getByRole("button", { name: /Create Project/i }).click();
  await expect(page).toHaveURL(/\/project\/.+/);
}
```

## Coverage

**Requirements:** Not enforced (no coverage configuration found)

**View Coverage:** No coverage reporting configured

**Estimated Coverage:**
- Utility functions: High (all functions in `src/lib/` have tests)
- Convex functions: High (projects, inputChannels, outputChannels all tested)
- Components: Minimal (no component unit tests found)
- E2E: Moderate (core workflows covered)

## Test Types

**Unit Tests:**
- Scope: Individual utility functions and pure functions
- Location: `tests/lib/` directory
- Approach: Direct function calls with known inputs/outputs
- Framework: Vitest
- Example: `incrementTrailingNumber("Vocal 1")` returns `"Vocal 2"`

**Integration Tests (Convex Tests):**
- Scope: Backend mutations, queries, and side effects
- Location: `convex/*.test.ts` colocated with source
- Approach: Use `convexTest()` framework to test full mutation flow
- Framework: Vitest with `convex-test`
- Example: Create project, verify default channels created, verify mixers setup
- Includes setup helpers for creating test data

**E2E Tests:**
- Scope: User workflows from browser perspective
- Location: `e2e/*.spec.ts`
- Approach: Playwright browser automation with page object queries
- Framework: Playwright
- Example: Navigate to dashboard, click New Project, fill form, verify navigation
- Tests real browser behavior including keyboard navigation
- Uses helpers to create prerequisite data (e.g., `createProject()`)

## Common Patterns

**Async Testing:**
```typescript
// From convex/projects.test.ts
it("should create a new project with default channels", async () => {
  const t = convexTest(schema, modules);

  const projectId = await t.mutation(api.projects.create, {
    title: "Test Concert",
    ownerId: "test-user",
  });

  expect(projectId).toBeDefined();
});
```

**Error Testing:**
```typescript
// Example pattern (from codebase analysis)
// Tests verify Error is thrown:
if (!original) throw new Error("Project not found");
```

**Array Length Testing:**
```typescript
// From convex/projects.test.ts
const projects = await t.query(api.projects.list, { ownerId: "user-1" });
expect(projects).toHaveLength(2);
```

**String Matching in E2E:**
```typescript
// From e2e tests
await expect(page.getByRole("heading", { name: "BetterPatchTool" })).toBeVisible();
await expect(page.getByRole("link", { name: /New Project/i })).toBeVisible();
```

**Keyboard Navigation Testing:**
```typescript
// From e2e/input-channels.spec.ts
await page.keyboard.type("Kick");
await page.keyboard.press("Enter");
```

## Test Execution

**Configuration Locations:**
- `vitest.config.ts`: Unit and Convex test configuration
- `playwright.config.ts`: E2E test configuration
- `tests/setup.ts`: Jest-DOM setup for jsdom environment

**Environment Setup:**
- Vitest uses jsdom environment
- Playwright uses chromium
- Tests run against `http://localhost:3000` (baseURL configured)
- Dev server auto-started by Playwright

**When to Run Tests:**
- After modifying Convex functions: `bun run test:run`
- After UI changes: Use Playwright MCP or `bun run test:e2e`
- During development: `bun run test` (watch mode)

---

*Testing analysis: 2026-01-21*
