# External Integrations

**Analysis Date:** 2026-01-21

## APIs & External Services

**Not Detected:**
- No third-party API integrations currently implemented
- No payment processing (Stripe, Lemonsqueezy, etc.)
- No email service (SendGrid, Mailgun, etc.)
- No analytics (Mixpanel, Segment, etc.)
- No error tracking (Sentry, LogRocket, etc.)

## Data Storage

**Databases:**
- Convex (real-time backend database)
  - Connection: `NEXT_PUBLIC_CONVEX_URL` environment variable
  - Client: `convex/react` (frontend), `convex/server` (backend)
  - Schema defined in `convex/schema.ts`
  - Tables: projects, users, mixers, ioDevices, ioPorts, inputChannels, outputChannels, groups, templates, blockPresets

**Database Schema Overview:**
```typescript
// Core entities (convex/schema.ts)
- users: User accounts with tier system (free, pro, team)
- projects: Audio projects with ownership and collaboration
- mixers: Console configurations (FOH, MON, etc.) with stereo mode
- ioDevices: Stageboxes and other IO devices (color-coded)
- ioPorts: Individual ports from IO devices (input/output, AES, headphone)
- inputChannels: Microphone/line input patches
- outputChannels: Speaker/destination output patches
- groups: Channel grouping presets
- templates: User-saved project templates
- blockPresets: Predefined channel group templates
```

**File Storage:**
- Not implemented
- Local filesystem only (if any file handling exists)

**Caching:**
- None implemented
- Convex handles query caching via reactive updates

## Authentication & Identity

**Auth Provider:**
- Convex (built-in authentication system)
  - Implementation: Custom user tracking via `ownerId` field (demo uses hardcoded DEMO_USER_ID)
  - Current approach: No OAuth or third-party auth (could be added via Convex auth integration)

**User Model:**
- Location: `convex/schema.ts` - users table
- Fields: email, name, tier (free/pro/team), lastLoginAt
- Multi-tenancy: Projects scoped to ownerId, collaborators array for sharing

**Current Auth Status:**
- Demo mode with hardcoded user ID
- Clerk auth commented out in `.env.local.example` (optional integration available)

## Real-Time Collaboration

**WebSocket Communication:**
- Convex handles all real-time sync automatically
- Backend: Convex ReactiveClient
- Frontend: `useQuery` hooks auto-subscribe to changes
- All data mutations trigger automatic client updates

**Reactive Data Flow:**
```typescript
// Example from src/app/project/[id]/page.tsx
const inputChannels = useQuery(api.inputChannels.list, { projectId });
// Auto-updates across all clients when data changes
```

## Monitoring & Observability

**Error Tracking:**
- Not implemented
- Recommendation: Consider Sentry or Convex error logging

**Logs:**
- Console logging only (browser dev tools)
- No centralized logging infrastructure

**Performance Monitoring:**
- Next.js Core Web Vitals via ESLint config
- No APM (Application Performance Monitoring) integration

## CI/CD & Deployment

**Hosting:**
- Frontend: Vercel, Netlify, or self-hosted Node.js (Next.js compatible)
- Backend: Convex Cloud (managed SaaS)

**CI Pipeline:**
- Not detected in repository
- Playwright E2E tests configured but no GitHub Actions or CI config

**Local Development:**
- Dual dev server setup required:
  1. `bun run dev` - Next.js dev server (port 3000)
  2. `bun x convex dev` - Convex local dev server (must run simultaneously)

## Environment Configuration

**Required Environment Variables:**

**Production/Development:**
- `NEXT_PUBLIC_CONVEX_URL` - Convex deployment URL (e.g., `https://aware-wolverine-755.convex.cloud`)
- `CONVEX_DEPLOYMENT` - Convex deployment ID (for local dev, e.g., `dev:aware-wolverine-755`)

**Optional (Commented Out):**
- `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` - Clerk auth (optional integration)
- `CLERK_SECRET_KEY` - Clerk auth secret (optional integration)

**Secrets Location:**
- `.env.local` - Local development (git-ignored)
- `.env` - Build-time placeholder values
- `.env.local.example` - Template for required variables

**Files:**
- `.env.local.example` location: `/Users/wilhelmduck/git/BetterPatchTool/.env.local.example`
- `.env.local` location: `/Users/wilhelmduck/git/BetterPatchTool/.env.local` (git-ignored)

## Webhooks & Callbacks

**Incoming Webhooks:**
- Not implemented

**Outgoing Webhooks:**
- Not implemented

**Real-Time Sync Alternative:**
- Convex provides WebSocket-based real-time sync instead of webhooks
- All mutations automatically broadcast to connected clients

## Data Models & Integration Points

**User Ownership & Collaboration:**
```typescript
// src/types/convex.ts
interface Project {
  ownerId: string;           // Project owner
  collaborators: string[];   // Array of collaborator IDs
  isArchived: boolean;
}
```

**Project Duplication (Data Integrity):**
- Implemented in `convex/projects.ts` - `duplicate()` mutation
- Deep copies: mixers, ioDevices, ioPorts, inputChannels, outputChannels, groups
- Maintains referential integrity with ID mapping

**Audio Patch Management:**
```typescript
// convex/schema.ts - Core patch data
interface InputChannel {
  projectId: Id<"projects">;
  mixerId?: Id<"mixers">;
  ioPortId?: Id<"ioPorts">;      // For mono patches
  ioPortIdRight?: Id<"ioPorts">; // For true stereo patches
  source: string;
  patched: boolean;
}

interface OutputChannel {
  projectId: Id<"projects">;
  mixerId?: Id<"mixers">;
  ioPortId?: Id<"ioPorts">;
  destination: string;
}
```

**Stereo Channel Support:**
- Convex schema: `isStereo` flag, `ioPortIdRight`, `sourceRight`, `destinationRight` fields
- Mixer stereo modes: `linked_mono` or `true_stereo`
- Location: `convex/schema.ts`, `convex/inputChannels.ts`, `convex/outputChannels.ts`

## Convex Function Organization

**Project Management:**
- File: `convex/projects.ts`
- Queries: `list`, `get`
- Mutations: `create`, `update`, `archive`, `duplicate`, `addCollaborator`

**Channel Management:**
- Input: `convex/inputChannels.ts` - CRUD, move, toggle stereo
- Output: `convex/outputChannels.ts` - CRUD, move
- Patching: `convex/patching.ts` - `patchInputChannel`, `patchOutputChannel`

**IO Device Management:**
- File: `convex/ioDevices.ts` - Stagebox/device CRUD, port management, reordering
- Includes port generation and position tracking

**Additional:**
- Mixers: `convex/mixers.ts` - Mixer CRUD
- Block Presets: `convex/blockPresets.ts` - Preset management
- Templates: Not yet implemented (schema defined, backend functions not visible)

## Testing Integration Points

**Convex Tests:**
- Location: `convex/*.test.ts` (inputChannels.test.ts, outputChannels.test.ts, projects.test.ts)
- Uses: `convex-test` package with `import.meta.glob` for module loading
- Coverage: Project CRUD/duplication, channel operations, move operations

**E2E Test Suite:**
- Location: `tests/e2e/` directory
- Framework: Playwright 1.57
- Tests: dashboard navigation, project creation, project workflow, input channel editing
- Config: `playwright.config.ts` - Chromium only, baseURL: `http://localhost:3000`

---

*Integration audit: 2026-01-21*
