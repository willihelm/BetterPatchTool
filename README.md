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

## MCP v1 (MCP Editing)

This repo includes an MCP endpoint for AI agents:

- Endpoint: `POST /api/mcp`
- Transport: Streamable HTTP (JSON-RPC style MCP requests)
- Auth:
  - OAuth (GitHub) session or OAuth bearer token
  - Client Credentials (`client_id` + `client_secret`) from app settings

### Setup

1. Configure GitHub OAuth on your Convex deployment (`AUTH_GITHUB_ID`, `AUTH_GITHUB_SECRET`).
2. Set a pepper for hashing MCP client secrets:
   ```bash
   bunx convex env set MCP_TOKEN_PEPPER "$(openssl rand -base64 32)"
   ```
   Use at least 32 bytes of cryptographically secure randomness for `MCP_TOKEN_PEPPER`.
3. Sign in to BetterPatchTool via GitHub OAuth.
4. Open `/settings/mcp-access` and create MCP client credentials for your MCP client (e.g. Claude Code).
5. Call MCP either:
   - with authenticated session (cookies) / OAuth bearer token, or
   - with HTTP Basic auth using `client_id:client_secret`.

### Claude Desktop example

Use an MCP server entry that points to your running Next.js app and provide your generated credentials:
Use HTTPS in production to protect Basic auth credentials in transit.

```json
{
  "mcpServers": {
    "betterpatchtool": {
      "url": "http://localhost:3000/api/mcp",
      "headers": {
        "Authorization": "Basic <base64(client_id:client_secret)>"
      }
    }
  }
}
```

Generate the header value with:

```bash
echo -n "<client_id>:<client_secret>" | base64
```

### cURL example (Basic auth)

```bash
curl -X POST http://localhost:3000/api/mcp \
  -H "Content-Type: application/json" \
  -u "<client_id>:<client_secret>" \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/list","params":{}}'
```

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
