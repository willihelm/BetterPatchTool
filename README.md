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

4. If you use auth, set `NEXT_PUBLIC_CONVEX_SITE_URL` to your Convex site URL in your Convex deployment environment, and set the same value locally when running `bunx convex dev`.

5. Start the frontend:

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
- GitHub OAuth values should be configured in the Convex dashboard.
- `NEXT_PUBLIC_CONVEX_SITE_URL` should be set in Convex env, and mirrored in `.env.local` for local auth/dev flows.

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

## MCP (Remote MCP Server with OAuth 2.1)

This repo includes a remote MCP server for AI agents:

- Endpoint: `https://<your-app>/api/mcp`
- Transport: Streamable HTTP (via [`mcp-handler`](https://github.com/vercel/mcp-handler))
- Auth: OAuth 2.1 with Dynamic Client Registration, PKCE (S256), refresh tokens, and a consent screen. End-user identity is the existing GitHub login.

### Connect from Claude

1. In Claude (Desktop or web), open **Settings → Connectors → Add custom connector**.
2. Paste `https://<your-app>/api/mcp`.
3. Your browser opens: sign in with GitHub, then approve the consent screen. Done — no keys to copy.

Authorized apps can be reviewed and revoked at `/settings/mcp-access` (Connected apps).

### Setup

1. Configure GitHub OAuth on your Convex deployment (`AUTH_GITHUB_ID`, `AUTH_GITHUB_SECRET`).
2. Set `NEXT_PUBLIC_CONVEX_SITE_URL` on the same Convex deployment to `https://<your-deployment>.convex.site`.
3. Set the canonical app origin for the Next.js app (used for the OAuth issuer, metadata, and `WWW-Authenticate` discovery):
   ```bash
   # .env.local / hosting provider env
   NEXT_PUBLIC_APP_URL=https://<your-app>
   ```
4. Set the MCP resource URL on the Convex deployment (RFC 8707 token audience binding):
   ```bash
   bunx convex env set MCP_RESOURCE_URL https://<your-app>/api/mcp
   ```

### Local development & testing

```bash
bunx convex dev   # backend
bun dev           # Next.js on http://localhost:3000
```

- Interactive inspector: `npx @modelcontextprotocol/inspector` against `http://localhost:3000/api/mcp` (exercises discovery → registration → login + consent → tools).
- Full OAuth dance from a CLI client: `npx mcp-remote http://localhost:3000/api/mcp`.

### Tool allowlist

- `list_projects`
- `get_project`
- `list_input_channels`
- `list_output_channels`
- `list_io_devices_with_ports`
- `update_project_meta`
- `update_input_channel`
- `update_output_channel`

## Project Structure

- `src/app` - Next.js app routes
- `src/components` - UI and feature components
- `src/lib` - shared utilities
- `convex` - backend functions, schema, and tests
- `tests` - Vitest and Playwright test suites
