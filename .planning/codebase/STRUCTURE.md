# Codebase Structure

**Analysis Date:** 2026-01-21

## Directory Layout

```
/Users/wilhelmduck/git/BetterPatchTool/
├── src/
│   ├── app/                    # Next.js App Router pages & layouts
│   ├── components/             # React components (UI, project-specific, providers)
│   ├── lib/                    # Utilities and helpers
│   ├── types/                  # TypeScript type definitions
│   └── hooks/                  # Custom React hooks (currently unused)
├── convex/
│   ├── schema.ts               # Database schema definition (source of truth)
│   ├── projects.ts             # Project CRUD + duplicate/archive mutations
│   ├── inputChannels.ts        # Input channel CRUD + reorder/move logic
│   ├── outputChannels.ts       # Output channel CRUD + reorder/move logic
│   ├── ioDevices.ts            # IO Device (stagebox) CRUD + port generation
│   ├── ioPorts.ts              # IO Port queries
│   ├── mixers.ts               # Mixer CRUD and queries
│   ├── blockPresets.ts         # Block preset (template) queries
│   ├── patching.ts             # Aggregated patching data query
│   ├── _generated/             # Auto-generated Convex types (DO NOT EDIT)
│   ├── *.test.ts               # Convex unit tests
│   └── convex.json             # Convex deployment config
├── tests/                      # Vitest unit tests & E2E tests
│   ├── e2e/                    # Playwright E2E tests
│   └── lib/                    # Unit tests (lib utilities)
├── .env.local                  # Environment variables (not committed)
├── next.config.ts              # Next.js configuration
├── tsconfig.json               # TypeScript configuration
├── package.json                # Dependencies & scripts
└── CLAUDE.md                   # Project instructions (this file)
```

## Directory Purposes

**src/app:**
- Purpose: Next.js App Router page/layout files (one per route)
- Contains: Page components (.tsx), layout wrappers, loading states, metadata
- Key files:
  - `layout.tsx`: Root layout, providers (Convex, Theme)
  - `page.tsx`: Redirect to dashboard
  - `dashboard/page.tsx`: Project list view
  - `projects/new/page.tsx`: Create project form
  - `project/[id]/page.tsx`: Main project editor (tabs, header)
  - `project/[id]/io/[deviceId]/page.tsx`: IO device detail edit page

**src/components/ui:**
- Purpose: shadcn/ui components (generic, reusable UI primitives)
- Contains: Button, Card, Input, Label, Dialog, Tabs, Badge, etc.
- Pattern: One component per file, exported as default; thin wrappers around Radix primitives

**src/components/project:**
- Purpose: Domain-specific components for the project editor (not reusable)
- Contains: Tables (input-channel-table, output-channel-table), views (stagebox-grid, patch-matrix), dialogs (mixer-settings, auto-patch), context (port-data-context)
- Files:
  - `input-channel-table.tsx`: TanStack Table for input channels; handles keyboard nav, cell editing
  - `output-channel-table.tsx`: TanStack Table for output channels
  - `patch-matrix.tsx`: 2D matrix view of input-to-output routing
  - `stagebox-overview.tsx`: Grid display of IO devices
  - `stagebox-grid.tsx`: Individual stagebox grid UI with draggable ports
  - `io-overview.tsx`: IO device list and management
  - `port-data-context.tsx`: React Context that aggregates port data; provides hooks `usePortData()`, `usePortInfo()`

**src/components/table:**
- Purpose: Table-specific concerns (cells, hooks)
- Contains:
  - `hooks/useKeyboardNavigation.ts`: Core keyboard navigation logic (Arrow keys, Tab, Enter, Alt+Arrow for row moves)
  - `cells/`: Cell component overrides (stereo port selects, editable text, etc.)

**src/components/providers:**
- Purpose: React Context providers for app-wide concerns
- Contains:
  - `convex-provider.tsx`: Wraps app with Convex React client (reads NEXT_PUBLIC_CONVEX_URL)
  - `theme-provider.tsx`: Wraps app with next-themes (dark mode support)

**src/components/features:**
- Purpose: Feature-specific components (likely future)
- Currently empty

**src/lib:**
- Purpose: Utilities and helper functions
- Contains:
  - `utils.ts`: `cn()` function (Tailwind class merging)
  - `date-utils.ts`: Date formatting (formatDistanceToNow, formatDate)
  - `string-utils.ts`: String utilities (incrementTrailingNumber)

**src/types:**
- Purpose: TypeScript type definitions
- Contains:
  - `convex.ts`: Manual types for Convex entities (Project, Mixer, IODevice, InputChannel, OutputChannel, IOPort, BlockPreset); synced with schema

**convex/schema.ts:**
- Purpose: Convex database schema; source of truth for data model
- Contains: defineTable() for each entity (projects, users, mixers, ioDevices, ioPorts, inputChannels, outputChannels, groups, blockPresets, templates)
- Indexes defined for common queries (by_project, by_owner, by_ioDevice, by_project_and_order)
- Fields use Convex `v.*` validators (v.string(), v.id(), v.optional(), v.array(), etc.)

**convex/*.ts (mutations & queries):**
- `projects.ts`: list (by ownerId), get, create (initializes mixer + empty channels), archive, duplicate
- `inputChannels.ts`: list (sorted by order), get, create, update, delete, move (reorder), insert (with copy-from-above + increment)
- `outputChannels.ts`: Same patterns as inputChannels
- `ioDevices.ts`: list, get, create (auto-generates ioPorts), update, delete, reorder
- `ioPorts.ts`: list, get (by device)
- `mixers.ts`: list (by project), get, create, update
- `blockPresets.ts`: list (public + user's), get, create, delete
- `patching.ts`: getAllPatchingData (aggregates all patching context for a project in one call)

**convex/_generated/:**
- Purpose: Auto-generated types and API definitions by `bunx convex dev`
- Contains: api.d.ts (function signatures), dataModel.d.ts (entity IDs), server.d.ts (Convex runtime types)
- DO NOT EDIT manually; regenerated on schema changes

**convex/*.test.ts:**
- Purpose: Unit tests for Convex functions (using convex-test)
- Files: projects.test.ts, inputChannels.test.ts, outputChannels.test.ts
- Pattern: Test CRUD, mutations (move, insert, delete), edge cases (empty projects, invalid orders)

**tests/e2e/:**
- Purpose: Playwright end-to-end tests
- Files: dashboard.spec.ts, project-creation.spec.ts, project-workflow.spec.ts, input-channels.spec.ts
- Pattern: Test full workflows (create project → edit channels → verify state)

**tests/lib/:**
- Purpose: Unit tests for frontend utilities (Vitest)
- Files: setup.ts (jest-dom), string-utils.test.ts, date-utils.test.ts
- Pattern: Test incrementTrailingNumber, formatDate, formatDistanceToNow

## Key File Locations

**Entry Points:**
- `src/app/layout.tsx`: Root layout with providers
- `src/app/page.tsx`: / route (redirects to /dashboard)
- `src/app/dashboard/page.tsx`: /dashboard (project list)
- `src/app/project/[id]/page.tsx`: /project/{id} (main editor)

**Configuration:**
- `package.json`: Dependencies, scripts (dev, build, test, lint)
- `tsconfig.json`: TypeScript config, path aliases (@/* → src/*)
- `next.config.ts`: Next.js config (minimal)
- `convex.json`: Convex project config (deployment)
- `.env.local`: NEXT_PUBLIC_CONVEX_URL (required to run)

**Core Logic:**
- `convex/schema.ts`: Database schema definition
- `convex/projects.ts`: Project lifecycle (create, archive, duplicate)
- `convex/inputChannels.ts`: Input channel mutations (create, update, move, insert)
- `convex/patching.ts`: Aggregated data for port selection UI

**Testing:**
- `convex/projects.test.ts`: Project CRUD tests
- `convex/inputChannels.test.ts`: Channel operation tests
- `tests/e2e/project-workflow.spec.ts`: Full user workflow tests

## Naming Conventions

**Files:**
- Components: camelCase (inputChannelTable.tsx, portDataContext.tsx)
- Hooks: camelCase with 'use' prefix (useKeyboardNavigation.ts, useChannelSelection.ts)
- Pages: camelCase or [brackets] for dynamic routes (page.tsx, [id]/page.tsx)
- Utilities: camelCase (dateUtils.ts, stringUtils.ts)
- Convex functions: camelCase (projects.ts, inputChannels.ts)

**Directories:**
- Components: feature/domain name (project/, ui/, table/, providers/)
- Routes: kebab-case in URL, camelCase in code (projects/new → /projects/new)
- Convex: table names match schema (projects, inputChannels, ioDevices)

**Types:**
- Entities: PascalCase (Project, Mixer, InputChannel, IODevice)
- Fields: camelCase (projectId, ioPortId, channelNumber)
- Schema field IDs: Lowercase with underscores (by_project, by_owner, by_ioDevice_and_type)

## Where to Add New Code

**New Feature (e.g., Grouping, Presets):**
- Backend:
  - Add table to `convex/schema.ts` (e.g., groups table with name, projectId, order)
  - Create `convex/groups.ts` with list, get, create, update, delete mutations
  - Add tests in `convex/groups.test.ts`
- Frontend:
  - Create type in `src/types/convex.ts`
  - Create component in `src/components/project/{feature}.tsx` (e.g., group-select-dialog.tsx)
  - Integrate into relevant page or table cell
  - Add tests in `tests/` or `e2e/` as needed

**New Component/Module:**
- If generic/reusable: `src/components/ui/` (only if shadcn-like or very generic)
- If project-specific: `src/components/project/` (domain components, tables, dialogs)
- If utility: `src/lib/` (helper functions, formatting)
- If hook: `src/hooks/` (shared stateful logic, context hooks)
- If page: `src/app/{route}/page.tsx` (follows Next.js routing)

**Utilities:**
- String/date formatting: `src/lib/string-utils.ts` or `src/lib/date-utils.ts`
- Shared helpers: `src/lib/utils.ts` (currently just `cn()`)
- Type definitions: `src/types/convex.ts` (manual) or `convex/_generated/` (auto)

**Testing:**
- Convex function tests: `convex/{module}.test.ts`
- React component tests (if added): `tests/lib/` with Vitest + React Testing Library
- E2E tests: `tests/e2e/{feature}.spec.ts` with Playwright

## Special Directories

**.next/:**
- Purpose: Build output directory
- Generated: Yes (by Next.js build)
- Committed: No (.gitignored)

**convex/_generated/:**
- Purpose: Auto-generated Convex type definitions and API client
- Generated: Yes (by `bunx convex dev`)
- Committed: Yes (checked into version control for CI/CD consistency)

**node_modules/:**
- Purpose: Dependencies
- Generated: Yes (by `bun install`)
- Committed: No (.gitignored)

**.env.local:**
- Purpose: Local environment variables (NEXT_PUBLIC_CONVEX_URL)
- Generated: No (must be created manually)
- Committed: No (.env.local.example provided as template)

**.planning/:**
- Purpose: GSD planning documents (generated by orchestrator)
- Generated: Yes (by /gsd:map-codebase, /gsd:plan-phase, etc.)
- Committed: Unclear (likely not committed as it's for planning only)

**playwright-report/ & .playwright-mcp/:**
- Purpose: Playwright test reports and MCP configuration
- Generated: Yes
- Committed: No

---

*Structure analysis: 2026-01-21*
