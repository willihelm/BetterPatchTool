# Tests Directory

This directory contains all tests for BetterPatchTool, organized by test type.

## Structure

```
tests/
├── e2e/                      # Playwright end-to-end tests
│   ├── dashboard.spec.ts     # Dashboard navigation
│   ├── project-creation.spec.ts  # Create project flow
│   ├── project-workflow.spec.ts  # Tab navigation, views
│   └── input-channels.spec.ts    # Channel editing, keyboard nav
├── lib/                      # Unit tests for utilities
│   ├── string-utils.test.ts  # Test incrementTrailingNumber
│   └── date-utils.test.ts    # Test formatDistanceToNow, formatDate
└── setup.ts                  # Vitest setup (jest-dom)
```

## Convex Tests

Convex unit tests are colocated with source code in the `convex/` directory:

```
convex/
├── inputChannels.test.ts     # Input channel CRUD, move, insert
├── outputChannels.test.ts    # Output channel CRUD, move
└── projects.test.ts          # Project CRUD, duplicate, archive
```

## Running Tests

### Unit Tests (Vitest)

```bash
# Watch mode (automatic re-run on file changes)
bun run test

# Run once (CI mode)
bun run test:run
```

Runs tests in `tests/lib/` and `convex/*.test.ts` files.

### E2E Tests (Playwright)

```bash
# Headless mode
bun run test:e2e

# UI mode (interactive browser)
bun run test:e2e:ui

# List available tests
bunx playwright test --list

# Run specific test file
bunx playwright test tests/e2e/dashboard.spec.ts

# Run with debugging
bunx playwright test --debug
```

## Configuration

- **Vitest config**: `vitest.config.ts` (jsdom environment, globals enabled)
- **Playwright config**: `playwright.config.ts` (Chromium, baseURL: `http://localhost:3000`)

## Setup

### Vitest Setup (`tests/setup.ts`)

Configures Jest-DOM matchers for DOM assertions in unit tests.

### Playwright Setup

Configured in `playwright.config.ts`:
- Single project: Chromium browser
- Web server: Auto-starts Next.js dev server (`bun run dev`)
- Base URL: `http://localhost:3000`
- Timeout: 2 minutes (120s)

## Test Artifacts

Generated during test runs (not committed):

```
playwright-report/     # HTML test report
test-results/          # Raw test results
.playwright-mcp/       # Playwright MCP configuration
```

View Playwright HTML report:

```bash
bunx playwright show-report
```

## Writing Tests

### Unit Test Template

```typescript
// tests/lib/example.test.ts
import { describe, it, expect } from "vitest";
import { exampleFunction } from "@/lib/example";

describe("exampleFunction", () => {
  it("should return expected result", () => {
    expect(exampleFunction("input")).toBe("output");
  });
});
```

### E2E Test Template

```typescript
// tests/e2e/example.spec.ts
import { test, expect } from "@playwright/test";

test.describe("Feature Name", () => {
  test("should do something", async ({ page }) => {
    await page.goto("/path");
    await expect(page.getByRole("heading", { name: "Title" })).toBeVisible();
  });
});
```

## Before Running Tests

Ensure both dev servers are running:

```bash
# Terminal 1: Next.js dev server
bun run dev

# Terminal 2: Convex dev server (if modifying Convex functions)
bun x convex dev
```

For E2E tests, Playwright automatically starts the Next.js dev server if not already running.

## CI/CD Considerations

- E2E tests require a running Next.js dev server
- Configure CI environment to install dependencies: `bun install`
- Set `CI=true` to enable stricter test settings (no parallelization for E2E)
- Ensure browser binary installed: `bunx playwright install chromium`
