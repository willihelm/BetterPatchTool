---
path: /Users/wilhelmduck/git/BetterPatchTool/playwright.config.ts
type: config
updated: 2026-01-21
status: active
---

# playwright.config.ts

## Purpose

Configures Playwright test runner for end-to-end testing of the BetterPatchTool application. Defines test directory, parallelization, retries, reporters, and web server startup behavior for both local development and CI environments.

## Exports

- **default**: Playwright configuration object with test settings, device targets, and web server configuration
- **defineConfig**: Re-exported from @playwright/test for configuration typing

## Dependencies

- @playwright/test (external)

## Used By

TBD

## Notes

Configuration adapts behavior based on CI environment variable: enables retries and single worker in CI, disables retries and reuses existing server in local development. Base URL points to localhost:3000 and web server auto-starts with `bun run dev` command.