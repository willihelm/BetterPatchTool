<!-- convex-ai-start -->
This project uses [Convex](https://convex.dev) as its backend.

When working on Convex code, **always read `convex/_generated/ai/guidelines.md` first** for important guidelines on how to correctly use Convex APIs and patterns. The file contains rules that override what you may have learned about Convex from training data.

Convex agent skills for common tasks can be installed by running `npx convex ai-files install`.
<!-- convex-ai-end -->


## Project Overview

BetterPatchTool is a web-based application for planning and managing audio patches for live events. It replaces Excel-based workflows with real-time collaboration, stagebox visualization, and intelligent validation. Target users are FOH engineers, monitor engineers, and system engineers.

## INTENT

This tool should allow a FAST and COMPREHENSIVE workflow! Optimize for speed in every change!

## Commands

```bash
# Development
bun run dev          # Start Next.js dev server
bun x convex dev     # Start Convex dev server (run in separate terminal)

# Build & Lint
bun run build        # Build for production
bun run lint         # Run ESLint

# Install dependencies
bun install
```

Both dev servers must run simultaneously during development.

**IMPORTANT**: Do NOT start or stop the dev servers unless explicitly instructed by the user. Assume they are already running in the background.

## Testing

### Playwright

If you use Playwright to test UI changes and bugs, start a subagent to do so as it fills up the context window very quickly.

### Commands

```bash
# Unit + Convex tests (Vitest)
bun run test          # Watch mode
bun run test:run      # Run once

# E2E tests (Playwright)
bun run test:e2e      # Run headless
bun run test:e2e:ui   # Run with UI
```

### Test Structure
```
tests/
├── e2e/                      # Playwright E2E tests
│   ├── dashboard.spec.ts     # Dashboard navigation
│   ├── project-creation.spec.ts # Create project flow
│   ├── project-workflow.spec.ts # Tab navigation, views
│   └── input-channels.spec.ts   # Channel editing, keyboard nav
├── lib/                      # Unit tests for utilities
│   ├── string-utils.test.ts  # incrementTrailingNumber
│   └── date-utils.test.ts    # formatDistanceToNow, formatDate
└── setup.ts                  # Vitest setup (jest-dom)

convex/
├── inputChannels.test.ts     # Input channel CRUD, move, insert
├── outputChannels.test.ts    # Output channel CRUD, move
└── projects.test.ts          # Project CRUD, duplicate, archive
```

### Running Tests After Changes
- **After modifying Convex functions**: Run `bun run test:run`
- **After UI changes**: Use Playwright MCP or `bun run test:e2e`
- **Convex tests use `convex-test`** with `import.meta.glob` for module loading

## Architecture

### Tech Stack
- **Frontend**: Next.js 15 (App Router) + React 19 + TypeScript
- **Backend/DB**: Convex (reactive real-time database)
- **UI**: Tailwind CSS + shadcn/ui components + Radix primitives
- **Tables**: TanStack Table for data grids
- **Runtime**: Bun

### Directory Structure
```
src/
├── app/                    # Next.js App Router pages
│   ├── dashboard/          # Project list
│   ├── project/[projectId]/ # Project editor (main view)
│   └── projects/new/       # Create project
├── components/
│   ├── project/            # Domain components (tables, stagebox view)
│   ├── providers/          # Context providers (Convex, Theme)
│   └── ui/                 # shadcn/ui components
├── lib/                    # Utilities (cn(), date formatting)
└── types/                  # TypeScript types

convex/
├── schema.ts               # Database schema (source of truth)
├── projects.ts             # Project CRUD + duplication
├── inputChannels.ts        # Input channel mutations/queries
├── outputChannels.ts       # Output channel mutations/queries
├── mixers.ts               # Mixer configuration
├── stageboxes.ts           # Stagebox + port management
└── blockPresets.ts         # Channel group presets
```

### Data Model (Key Entities)
- **Project**: Contains mixers, stageboxes, channels. Has owner + collaborators.
- **Mixer**: Console configuration with stereo mode (`linked_mono` | `true_stereo`)
- **Stagebox**: Has inputs/outputs, color coding, generates StageboxPorts
- **InputChannel/OutputChannel**: The actual patch data, ordered by `order` field
- **BlockPreset**: Predefined channel groups for quick insertion

### Real-Time Collaboration
Convex handles all real-time sync automatically via reactive queries:
```typescript
const channels = useQuery(api.inputChannels.list, { projectId });
// Auto-updates across all clients when data changes
```

### Table Navigation (Excel-like UX)
The input/output tables implement spreadsheet-style navigation:
- Tab/Shift+Tab: Move between cells
- Enter: Move down, start editing
- Arrow keys: Navigate cells
- Alt+Arrow: Move row up/down
- Alt+Enter: Copy from above + increment number
- F2/typing: Start editing
- Delete/Backspace: Clear cell

## Environment Setup

Copy `.env.local.example` to `.env.local` and set:
```
NEXT_PUBLIC_CONVEX_URL=<your-convex-deployment-url>
```

## Path Aliases

`@/*` maps to `./src/*` (configured in tsconfig.json)

<!-- convex-ai-start -->
This project uses [Convex](https://convex.dev) as its backend.

When working on Convex code, **always read `convex/_generated/ai/guidelines.md` first** for important guidelines on how to correctly use Convex APIs and patterns. The file contains rules that override what you may have learned about Convex from training data.

Convex agent skills for common tasks can be installed by running `npx convex ai-files install`.
<!-- convex-ai-end -->
