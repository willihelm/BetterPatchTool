# Technology Stack

**Analysis Date:** 2026-01-21

## Languages

**Primary:**
- TypeScript 5.0 - Full codebase (frontend and backend)
- JavaScript/JSX - React components (transpiled from TypeScript)

**Configuration:**
- JSON - Package manifests and configuration
- PostCSS/Tailwind - Styling

## Runtime

**Environment:**
- Node.js (implied by Next.js and Bun)
- Bun 1.x - Package manager and runtime

**Package Manager:**
- Bun
- Lockfile: `bun.lock` (present and committed)

## Frameworks

**Core Frontend:**
- Next.js 15.0 - App Router, Server Components (SSR/SSG)
- React 19 - UI library with Hooks API
- TypeScript 5 - Type safety

**Backend/Database:**
- Convex 1.17 - Real-time backend, database, authentication system
- Convex schema defined in `convex/schema.ts`

**UI Components:**
- shadcn/ui - Headless component library
- Radix UI (underlying primitives) - Dialog, Dropdown, Checkbox, Tabs, Select, Label, Slot, Separator
- Tailwind CSS 3.4 - Utility-first styling engine

**Table/Data Grid:**
- TanStack Table 8.20 - Data grid component library (imported but specific usage in `src/components/project/input-channel-table.tsx` and `src/components/project/output-channel-table.tsx`)

**Animation/Motion:**
- Framer Motion 11.0 - React animation library

**Drag & Drop:**
- @dnd-kit/core 6.3.1 - Drag-and-drop system
- @dnd-kit/sortable 10.0.0 - Sortable extension
- @dnd-kit/utilities 3.2.2 - Utility functions

**Theme Management:**
- next-themes 0.4 - Dark/light mode provider with system detection

**Icons:**
- lucide-react 0.460.0 - Icon component library

**Utilities:**
- zod 3.22 - TypeScript-first schema validation
- class-variance-authority 0.7 - Type-safe CSS variant system
- clsx 2.1 - Conditional classname builder
- tailwind-merge 2.2 - Tailwind class merging utility

## Testing

**Unit & Integration Tests:**
- Vitest 4.0.17 - Test runner (Jest-compatible)
- jsdom 27.4.0 - DOM simulation for tests
- @testing-library/react 16.3.2 - React testing utilities
- @testing-library/dom 10.4.1 - DOM testing utilities
- @testing-library/jest-dom 6.9.1 - Custom Jest matchers
- @vitejs/plugin-react 5.1.2 - Vitest React plugin

**E2E Tests:**
- Playwright 1.57.0 - End-to-end testing framework

**Convex Testing:**
- convex-test 0.0.41 - Convex-specific test utilities for unit testing Convex functions

## Build & Development

**Next.js Build:**
- next 15.0.0 - Build system and dev server
- TypeScript 5 - Compilation

**CSS Processing:**
- Tailwind CSS 3.4.0 - CSS framework
- Autoprefixer 10.0.0 - Vendor prefixes
- PostCSS 8.0.0 - CSS transformation

**ESLint:**
- eslint 8.0.0 - Code linting
- eslint-config-next 15.0.0 - Next.js-specific rules

## Configuration Files

**TypeScript:**
- `tsconfig.json` - Main frontend config (target: ES2017, strict mode enabled)
- `convex/tsconfig.json` - Backend config (target: ESNext)
- Path alias: `@/*` → `./src/*`

**Next.js:**
- `next.config.ts` - Minimal config with React Strict Mode enabled
- `next.config.ts` location: `/Users/wilhelmduck/git/BetterPatchTool/next.config.ts`

**ESLint:**
- `.eslintrc.json` - Extends `next/core-web-vitals` config
- Location: `/Users/wilhelmduck/git/BetterPatchTool/.eslintrc.json`

**Tailwind CSS:**
- `tailwind.config.ts` - Custom color theming with HSL variables
- Location: `/Users/wilhelmduck/git/BetterPatchTool/tailwind.config.ts`
- Dark mode: Class-based switching via next-themes

**PostCSS:**
- `postcss.config.mjs` - Tailwind + Autoprefixer pipeline
- Location: `/Users/wilhelmduck/git/BetterPatchTool/postcss.config.mjs`

**Testing:**
- `vitest.config.ts` - jsdom environment, globals enabled, setupFiles: `tests/setup.ts`
- `playwright.config.ts` - E2E tests on Chromium, baseURL: `http://localhost:3000`
- Location: `/Users/wilhelmduck/git/BetterPatchTool/playwright.config.ts`

**shadcn/ui:**
- `components.json` - Component library config
- Style: new-york, RSC: true, Aliases configured in tsconfig

## Project Structure for Dependencies

**Frontend Components:**
- Entry: `src/app/layout.tsx` - Root layout with providers
- Main app pages in `src/app/` (dashboard, project, IO management)
- Reusable components in `src/components/` (ui/, project/, providers/)
- Utilities in `src/lib/` (cn(), date utilities, string utilities)
- Types in `src/types/convex.ts` (temporary until Convex generates types)

**Backend:**
- Convex schema: `convex/schema.ts`
- Convex functions: `convex/projects.ts`, `convex/inputChannels.ts`, `convex/outputChannels.ts`, `convex/ioDevices.ts`, `convex/patching.ts`, `convex/blockPresets.ts`, `convex/mixers.ts`
- Convex tests: `convex/*.test.ts` (using `convex-test`)

## Development Environment

**Required Environment Variables:**
- `NEXT_PUBLIC_CONVEX_URL` - Convex deployment URL (required at runtime)
- `CONVEX_DEPLOYMENT` - Convex deployment identifier (for local dev)

**Example `.env.local`:**
```
CONVEX_DEPLOYMENT=dev:aware-wolverine-755
NEXT_PUBLIC_CONVEX_URL=https://aware-wolverine-755.convex.cloud
```

## Development Commands

```bash
# Start dev server
bun run dev                # Next.js dev (port 3000)
bun x convex dev          # Convex dev (run in separate terminal)

# Build for production
bun run build

# Linting
bun run lint

# Testing
bun run test              # Vitest watch mode
bun run test:run          # Vitest run once
bun run test:e2e          # Playwright headless
bun run test:e2e:ui       # Playwright with UI
```

## Critical Dependencies by Tier

**Tier 1 (Core):**
- convex 1.17.0 - Entire backend and real-time sync
- next 15.0.0 - Framework backbone
- react 19.0.0 - Component library
- typescript 5.0.0 - Language and type system

**Tier 2 (UI/UX):**
- tailwindcss 3.4.0 - Styling
- @radix-ui/* - Accessible primitives
- shadcn/ui - Component system
- framer-motion 11.0.0 - Animations
- @dnd-kit/* - Drag-and-drop

**Tier 3 (Utilities):**
- zod 3.22.0 - Runtime validation (for Convex schema validation)
- class-variance-authority 0.7.0 - Component styling variants
- lucide-react 0.460.0 - Icons

## Production Build Considerations

**Frontend:**
- Built with `next build` and `bun run build`
- Outputs to `.next/` directory
- Requires `NEXT_PUBLIC_CONVEX_URL` at build time (can be placeholder)

**Backend:**
- Convex deploys separately (not part of Next.js build)
- Convex functions deployed to Convex cloud
- Real-time sync via WebSocket to `NEXT_PUBLIC_CONVEX_URL`

## Deployment Targets

**Frontend:**
- Next.js App Router compatible with Vercel, Netlify, Docker, or Node.js hosting
- Requires Node.js 18+ or Bun runtime

**Backend:**
- Convex Cloud (SaaS) - Hosted database and functions
- Real-time WebSocket connection between frontend and Convex

---

*Stack analysis: 2026-01-21*
