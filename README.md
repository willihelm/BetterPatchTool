# BetterPatchTool

BetterPatchTool is a Next.js application for building and managing audio patch lists and related project data. The app uses Convex for backend data/auth and Bun as the package manager/runtime for local scripts.

## Requirements

- Bun
- Node.js 20+ recommended

## Getting Started

1. Install dependencies:

```bash
bun install
```

2. Create a local environment file:

```bash
cp .env.local.example .env.local
```

3. Set `NEXT_PUBLIC_CONVEX_URL` in `.env.local` to your Convex deployment URL.

4. Start the frontend:

```bash
bun run dev
```

5. Open `http://localhost:3000`.

## Running Convex

If you are working on backend functions, start Convex in a second terminal:

```bash
bunx convex dev
```

Notes:

- `NEXT_PUBLIC_CONVEX_URL` is required for the app to connect to Convex from the browser.
- GitHub OAuth values mentioned in `.env.local.example` should be configured in the Convex dashboard, not in `.env.local`.

## Available Scripts

```bash
bun run dev        # Start Next.js in development
bun run build      # Build the production app
bun run start      # Start the production server
bun run lint       # Run linting
bun run test       # Run Vitest in watch mode
bun run test:run   # Run Vitest once
bun run test:e2e   # Run Playwright end-to-end tests
bun run test:e2e:ui # Run Playwright in UI mode
```

## Testing

Run unit tests:

```bash
bun run test:run
```

Run end-to-end tests:

```bash
bun run test:e2e
```

Playwright uses `http://localhost:3000` and will start the Next.js dev server automatically if needed.

## Project Structure

- `src/app` - Next.js app routes
- `src/components` - UI and feature components
- `src/lib` - shared utilities
- `convex` - backend functions, schema, and tests
- `tests` - Vitest and Playwright test suites
