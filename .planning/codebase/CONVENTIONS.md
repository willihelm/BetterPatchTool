# Coding Conventions

**Analysis Date:** 2026-01-21

## Naming Patterns

**Files:**
- Kebab-case for all files: `input-channel-table.tsx`, `date-utils.ts`, `auto-patch-dialog.tsx`
- Component files use descriptive, domain-specific names reflecting their domain function
- Utility files follow pattern: `<domain>-utils.ts` (e.g., `date-utils.ts`, `string-utils.ts`)
- Test files match source names: `string-utils.test.ts` for `string-utils.ts`
- Page routes use directory structure: `app/dashboard/page.tsx`, `app/project/[id]/page.tsx`

**Functions:**
- camelCase for all functions: `formatDistanceToNow()`, `incrementTrailingNumber()`, `handleAddChannel()`
- Event handlers prefixed with `handle`: `handleArchive()`, `handleDuplicate()`, `handleAddChannel()`
- Query/mutation functions in Convex are lowercase: `create()`, `list()`, `get()`, `archive()`, `duplicate()`
- React hooks follow `use*` pattern: `useChannelSelection()`, `usePortData()`, `useQuery()`, `useMutation()`
- Helper functions inside components follow camelCase: `setupProject()` (in tests)

**Variables:**
- camelCase for all variable names: `projectId`, `channelIds`, `isArchived`, `isStereoAvailable`
- Constants use UPPER_SNAKE_CASE: `DEMO_USER_ID`, `EDITABLE_COLUMNS`, `ALL_COLUMNS`
- Boolean variables prefixed with `is` or `has`: `isPatched`, `isArchived`, `isVisible`, `hasLength`
- Reference variables prefixed with descriptive type: `containerRef`, `channelsRef`, `firstMixer`
- Prefixed state setters: `setPortDropdownOpen()`, `setAutoPatchDialogOpen()`, `setActiveCell()`

**Types:**
- PascalCase for all TypeScript interfaces and types: `InputChannel`, `Project`, `InputChannelTableProps`
- Generics use single capital letters or descriptive PascalCase: `<T>`, `<Id<"projects">>`, `<ReturnType>`
- Union types spelled out: `"input" | "output"`, `"linked_mono" | "true_stereo"`

**Imports:**
- Organize imports in groups separated by blank lines:
  1. React and external libraries: `import { useState } from "react"`
  2. Convex imports: `import { useQuery, useMutation } from "convex/react"`
  3. Generated types: `import { api } from "../../../convex/_generated/api"`
  4. UI components: `import { Button } from "@/components/ui/button"`
  5. Custom components: `import { PortSelectCell } from "./port-select-cell"`
  6. Utilities and types: `import { incrementTrailingNumber } from "@/lib/string-utils"`
- Use named imports for most cases
- Use path aliases (`@/`) for imports from `src/` directory
- Relative imports (`./`, `../`) only for sibling/parent components in same directory

## Code Style

**Formatting:**
- ESLint config extends `next/core-web-vitals`
- TypeScript strict mode enabled
- 2-space indentation (inferred from codebase)
- Semicolons required
- Double quotes for strings (seen in code)

**Linting:**
- Tool: ESLint with Next.js configuration
- Config location: `.eslintrc.json`
- Run via: `bun run lint`
- Rules enforced from Next.js core-web-vitals preset

**Prettier:**
- Not explicitly configured in codebase (no `.prettierrc` file)
- Rely on ESLint configuration for formatting

## Import Organization

**Order:**
1. React library imports: `import { useState, useCallback } from "react"`
2. External libraries: `import { useQuery, useMutation } from "convex/react"`
3. API/generated imports: `import { api } from "../../../convex/_generated/api"`
4. UI components: `import { Button } from "@/components/ui/button"`
5. Custom domain components: `import { PortSelectCell } from "./port-select-cell"`
6. Hooks and utilities: `import { useChannelSelection } from "./use-channel-selection"`
7. Type imports: `import type { InputChannel } from "@/types/convex"`

**Path Aliases:**
- `@/*` maps to `./src/*` (configured in `tsconfig.json`)
- All imports from `src/` use `@/` prefix
- Never use relative paths for imports from outside current directory tree

## Error Handling

**Patterns:**
- Convex functions use direct `throw new Error()` for validation failures:
  ```typescript
  if (!original) throw new Error("Project not found");
  ```
- Client-side mutations catch and log errors:
  ```typescript
  console.error("Error creating project:", error);
  ```
- Errors are descriptive and include context
- No custom error classes currently in use
- Errors are handled at mutation/function call sites, not wrapped globally

**Best Practices:**
- Always validate input before operations in Convex functions
- Log errors to console with descriptive messages
- No silent failures - always alert user or throw error

## Logging

**Framework:** `console` object (no logging library)

**Patterns:**
- Use `console.error()` for error logging:
  ```typescript
  console.error("Error creating project:", error);
  ```
- No debug logging currently in place
- Minimal logging - only errors and critical operations
- No structured logging or log levels

**Guidelines:**
- Log errors with context about what operation failed
- Include relevant IDs or data in error messages
- Use descriptive error messages for debugging

## Comments

**When to Comment:**
- Document complex algorithms and business logic
- Explain "why", not "what" (code should be self-documenting for "what")
- Used sparingly - mostly found in utility functions
- Don't comment obvious code

**JSDoc/TSDoc:**
- Used for exported utility functions with examples:
  ```typescript
  /**
   * Increments the trailing number in a string.
   * If the string ends with a number, increments it by 1.
   * If no trailing number exists, returns the original string.
   *
   * @example
   * incrementTrailingNumber("Vocal 1") // "Vocal 2"
   */
  export function incrementTrailingNumber(value: string): string {
  ```
- Include `@example` blocks showing usage
- Describe parameters and return values clearly
- Used primarily for public utility functions

## Function Design

**Size:** Functions are typically small to medium (30-100 lines)
- React components like `InputChannelTable` can be larger (500+ lines for complex logic)
- Mutations and queries kept concise and focused
- Extracted into smaller helpers when complex

**Parameters:**
- Use object destructuring for multiple parameters:
  ```typescript
  export function InputChannelTable({ projectId }: InputChannelTableProps)
  ```
- Type parameters explicitly with interfaces
- Optional parameters marked with `?`
- No positional parameters for functions with >2 parameters

**Return Values:**
- Functions return typed values (TypeScript strict mode enforced)
- Queries return database documents or collections
- Mutations return created/updated IDs or documents
- Void returns only for event handlers and side-effect functions
- No implicit undefined returns - be explicit

## Module Design

**Exports:**
- Named exports for functions and components:
  ```typescript
  export function InputChannelTable({ projectId }: InputChannelTableProps)
  export const list = query({ ... })
  ```
- Default exports used only for page components
- Single responsibility per file

**Barrel Files:**
- Not used in this codebase
- Each component/utility imported directly from its file

**Component Structure:**
- "use client" directive at top of client components
- Props interface defined before component function
- Component function exported as named export
- Hooks at top of component function body
- State management initialized before render logic
- Event handlers defined before JSX

---

*Convention analysis: 2026-01-21*
