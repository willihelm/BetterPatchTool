# Architecture

**Analysis Date:** 2026-01-21

## Pattern Overview

**Overall:** Next.js 15 full-stack application with Convex backend (real-time reactive database) as a single "system of truth" replacing traditional Express/Node backend patterns.

**Key Characteristics:**
- Frontend (Next.js) and backend (Convex functions) are tightly integrated via reactive queries
- No separate REST API layer; Convex handles both data storage and computation
- Real-time collaboration built in automatically—all clients receive updates when data changes
- Spreadsheet-style UI with Excel-like keyboard navigation for audio patching workflows
- Monolithic project structure with clear separation of frontend concerns (UI, hooks, pages) and backend concerns (database schema, mutations, queries)

## Layers

**Presentation Layer (Frontend):**
- Purpose: UI rendering, user interaction, form handling, real-time data display
- Location: `src/app/`, `src/components/`, `src/pages/` (Next.js App Router)
- Contains: React components, pages, layouts, shadcn/ui primitives, TanStack Table implementations
- Depends on: Convex reactive queries, UI utilities, TypeScript types
- Used by: Browser, client-side navigation

**Business Logic Layer (Convex Functions):**
- Purpose: Data mutations, queries, complex calculations, validation
- Location: `convex/*.ts` (projects.ts, inputChannels.ts, outputChannels.ts, ioDevices.ts, patching.ts, etc.)
- Contains: Queries (read-only), mutations (write), aggregation functions
- Depends on: Convex database schema, Convex values validation (v.*)
- Used by: Frontend via useQuery/useMutation hooks, real-time subscriptions

**Data Access Layer (Convex Database):**
- Purpose: Persistent data storage with real-time synchronization
- Location: `convex/schema.ts`
- Contains: Table definitions, indexes, field schemas
- Depends on: Convex server infrastructure
- Used by: All Convex functions

**UI Utilities & Helpers:**
- Purpose: Reusable UI patterns, styling, formatting
- Location: `src/lib/` (cn(), formatDate, incrementTrailingNumber, etc.), `src/components/ui/` (shadcn components)
- Contains: Utility functions, Tailwind utilities, date/string formatting
- Depends on: External packages (clsx, tailwind-merge, lucide-react)
- Used by: Components throughout the app

## Data Flow

**Real-Time Project Editing:**

1. User opens project → `ProjectPage` (client component at `src/app/project/[id]/page.tsx`)
2. Component calls `useQuery(api.projects.get, { projectId })` → Convex subscribes to project changes
3. Project data loads, user sees tabs: Patch List, Patch Matrix, Stageboxes, IO Devices
4. User edits input channel in table → `InputChannelTable` calls mutation
5. Mutation updates database in `convex/inputChannels.ts` (e.g., `update`, `move`, `insert`)
6. Convex broadcasts change to all connected clients with matching query
7. UI re-renders with fresh data automatically (no manual refresh needed)

**Stagebox Port Patching Workflow:**

1. `PortDataProvider` at `src/components/project/port-data-context.tsx` wraps tab content
2. Provider calls `useQuery(api.patching.getAllPatchingData, { projectId })`
3. Query aggregates: ioDevices, ioPorts, inputChannels, outputChannels in one call
4. Returns structured data: `{ portInfoMap, portUsageMap, inputPortGroups, outputPortGroups }`
5. Child components (e.g., `stereo-port-select-cell.tsx`) access data via `usePortData()` context hook
6. When user selects a port for a channel, component calls `inputChannels.update` mutation
7. Database updates, context value recalculates, UI updates

**Keyboard-Driven Table Navigation:**

1. User focuses table cell (clicks or tabs to it)
2. `useKeyboardNavigation` hook (at `src/components/table/hooks/useKeyboardNavigation.ts`) captures keydown events
3. Hook maps keys: Tab → move right, Shift+Tab → left, Enter → down, Arrow keys → directions, Alt+Arrow → move row
4. On cell change, `onCellChange` callback fires → row state updates
5. User presses F2 or types → starts editing mode
6. On save (Enter outside edit field), mutation fires to update database
7. Convex confirms update → UI re-renders

**State Management:**
- Query state: Convex manages it; components subscribe via `useQuery()` (returns undefined while loading, null if not found, data if present)
- Local component state: Minimal; used only for UI interactivity (active cell, editing mode, dropdown open)
- Context for shared UI state: `PortDataProvider` aggregates port data to avoid multiple queries from child components
- No Redux/Zustand; Convex reactivity is the primary state management mechanism

## Key Abstractions

**Project:**
- Purpose: Represents a single audio patch planning session (venue/date/channels)
- Examples: `src/types/convex.ts` (Project interface), `convex/schema.ts` (projects table), `convex/projects.ts` (CRUD mutations)
- Pattern: Aggregate root; owns mixers, IO devices, channels, groups. One user owns, others can collaborate.

**Mixer:**
- Purpose: Console configuration (name, channel count, stereo mode)
- Examples: `convex/schema.ts` (mixers table), `convex/mixers.ts` (queries/mutations)
- Pattern: Owned by project; defaults to "FOH" on project creation. Supports `linked_mono` or `true_stereo` modes.

**InputChannel / OutputChannel:**
- Purpose: Represents a single audio patch row in the patch list
- Examples: `src/types/convex.ts` (InputChannel/OutputChannel interfaces), `convex/inputChannels.ts` (mutations), `src/components/project/input-channel-table.tsx` (UI table)
- Pattern: Ordered by `order` field (not ID). Connects to IOPort, Mixer, and Group. Supports stereo linking via `isStereo` + `ioPortIdRight`.

**IODevice (Stagebox / Generic):**
- Purpose: Physical or logical audio device with ports (inputs/outputs)
- Examples: `convex/schema.ts` (ioDevices table), `convex/ioDevices.ts` (mutations), `src/components/project/stagebox-overview.tsx` (UI grid)
- Pattern: Project owns many; can be stagebox (grid display) or generic. Positions track spatial layout. Ports auto-generated from count.

**IOPort:**
- Purpose: Individual connectors on an IODevice
- Examples: `convex/schema.ts` (ioPorts table), auto-generated by ioDevices mutation
- Pattern: Not manually created; generated when IODevice is created (e.g., 48 input ports → 48 IOPort records). SubTypes support headphone stereo pairs, AES pairs.

**PortDataProvider Context:**
- Purpose: Avoid N+1 queries; pre-aggregate port data for consumption by port select dropdowns
- Examples: `src/components/project/port-data-context.tsx`
- Pattern: Wraps tab content, fetches once via `patching.getAllPatchingData`, distributes maps and groups to child cells via `usePortData()`.

**BlockPreset:**
- Purpose: Predefined channel group templates for quick insertion (e.g., "stereo pair," "mic array")
- Examples: `convex/schema.ts` (blockPresets table), `convex/blockPresets.ts` (queries)
- Pattern: User-created or system-provided; channels field is JSON stringified; used in import dialogs.

## Entry Points

**Root Layout:**
- Location: `src/app/layout.tsx`
- Triggers: Every page render
- Responsibilities: Provider setup (Convex, Theme), metadata, HTML structure

**Dashboard Page:**
- Location: `src/app/dashboard/page.tsx`
- Triggers: User navigates to `/dashboard` or root `/`
- Responsibilities: List projects, show new/duplicate/archive buttons, load user's projects via `api.projects.list`

**Project Page:**
- Location: `src/app/project/[id]/page.tsx`
- Triggers: User clicks into project or navigates to `/project/{id}`
- Responsibilities: Load project, render header (title, venue, mixer badge), render 4 main tabs (Patch List, Matrix, Stageboxes, IO), wrap with `PortDataProvider`

**Create Project Page:**
- Location: `src/app/projects/new/page.tsx`
- Triggers: User clicks "New Project" button on dashboard
- Responsibilities: Form for project title/date/venue/channel counts, call `api.projects.create` mutation

**IO Device Edit Page:**
- Location: `src/app/project/[id]/io/[deviceId]/page.tsx`
- Triggers: User clicks edit icon on stagebox or IO device in overview
- Responsibilities: Detailed port editing for a single device (add/remove/rename ports)

## Error Handling

**Strategy:** Try/catch at mutation call sites; errors logged to console; UI shows loading spinner during async operations. No centralized error boundary yet.

**Patterns:**
- Input validation: Convex `v.` schema validates args before function runs; invalid args rejected at boundary
- Database errors: Caught at component level in try/catch; could bubble to error boundary
- Missing data: Queries return `undefined` (loading), `null` (not found), or data; components check explicitly
- Example at `src/app/projects/new/page.tsx`: try/catch around `createProject()` mutation catches errors and logs

## Cross-Cutting Concerns

**Logging:** Console methods only; no centralized logging framework (potential future concern)

**Validation:** Convex `v.*` schema validation in all query/mutation args; Zod not yet integrated but included in package.json (potential future use)

**Authentication:** Currently hardcoded `DEMO_USER_ID` ("demo-user-123") placeholder; auth system (Clerk) noted as TODO in codebase. `ownerId` and `collaborators` fields exist in schema but not enforced.

**Real-Time Sync:** Automatic via Convex reactive queries; no manual polling or WebSocket management

**Styling:** Tailwind CSS + shadcn/ui components; dark mode via next-themes; no custom CSS files needed for standard components

**Keyboard UX:** Centralized in `src/components/table/hooks/useKeyboardNavigation.ts`; used by input/output channel tables and patch matrix

---

*Architecture analysis: 2026-01-21*
