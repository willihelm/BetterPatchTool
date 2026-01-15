# BetterPatchTool - Product Requirements Document (PRD)

## 1. Executive Summary

**Product Name:** BetterPatchTool
**Version:** 1.0
**Date:** 2026-01-14

BetterPatchTool is a web-based application for planning and managing audio patches for live events. The app replaces Excel-based workflows with a specialized solution featuring real-time collaboration, graphical stagebox visualization, and intelligent validation.

---

## 2. Problem Statement

### Current Situation
- Audio patch plans are created and maintained in Excel
- Manual linking for stagebox overviews is error-prone
- No real-time collaboration possible
- No automatic conflict validation
- Formatting and export are cumbersome

### Goals
- More efficient creation of patch plans
- Reduction of errors through automatic validation
- Real-time team collaboration
- Professional exports for production and crew

---

## 3. Target Audience

- **Primary:** FOH engineers, monitor engineers, system engineers
- **Secondary:** Production managers, tour managers, venue technicians

---

## 4. Functional Requirements

### 4.1 Project Management

| Feature | Description | Priority |
|---------|-------------|----------|
| Create project | Create new event/project with title, date, venue | Must |
| Duplicate project | Copy existing project as template | Should |
| Archive project | Archive completed projects | Could |
| Share project | Link to share with other users | Must |

### 4.2 Mixer Configuration

| Feature | Description | Priority |
|---------|-------------|----------|
| Create mixer | Define name, type, number of channels | Must |
| Stereo mode | Configuration for how stereo channels are handled | Must |
| Multiple mixers | Support for A/B/C mixers (FOH, Monitor, Broadcast) | Should |

**Stereo Channel Modes:**

```
┌─────────────────────────────────────────────────────────────────────┐
│  Mode 1: LINKED MONO (classic)                                      │
│  ─────────────────────────────────────────────────────────────────  │
│  Two mono channels are linked. Stereo occupies 2 channel numbers.   │
│                                                                     │
│  Example "Keys Stereo":                                             │
│  Ch 14 │ Keys L    │ SG-KM-I3                                       │
│  Ch 15 │ Keys R    │ SG-KM-I4    ← Linked with Ch 14                │
│                                                                     │
│  Consoles: Yamaha M7CL, Midas M32, Allen & Heath GLD, older desks   │
└─────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────┐
│  Mode 2: TRUE STEREO (native)                                       │
│  ─────────────────────────────────────────────────────────────────  │
│  One channel is natively stereo and occupies only one channel num.  │
│  Two stagebox ports are assigned to one channel.                    │
│                                                                     │
│  Example "Keys Stereo":                                             │
│  Ch 14 │ Keys      │ SG-KM-I3 (L) / SG-KM-I4 (R)   ← One channel   │
│                                                                     │
│  Consoles: Yamaha CL/QL, DiGiCo SD, Avid S6L                        │
└─────────────────────────────────────────────────────────────────────┘
```

**Effects on Block Presets:**
- With "Linked Mono": Stereo preset inserts 2 rows (L/R)
- With "True Stereo": Stereo preset inserts 1 row with 2 stagebox ports

**Mixer Settings:**
```
Mixer: "FOH"
├── Type: Yamaha CL5
├── Stereo Mode: True Stereo
├── Channels: 72
└── Designation: A
```

### 4.3 Stagebox Configuration

| Feature | Description | Priority |
|---------|-------------|----------|
| Create stagebox | Define name, type, number of inputs/outputs | Must |
| Flexible naming | Freely definable port designations (e.g. IOX-D-I1) | Must |
| Color coding | Individual colors per stagebox | Must |
| Stagebox templates | Save/load predefined stageboxes | Should |
| Drag & drop arrangement | Position stageboxes in stage plan | Could |

**Example Stagebox Configuration:**
```
Stagebox: "IOX-D" (Drums)
- Color: Green (#90EE90)
- Inputs: 12
- Outputs: 4
- Port Prefix: "IOX-D-I" / "IOX-D-O"
```

### 4.4 Input Patch List

The main table for all inputs:

| Column | Type | Description | Required |
|--------|------|-------------|----------|
| Mixer | Dropdown | Mixer assignment (A, B, C...) | Yes |
| Ch | Number | Channel number on mixer | Yes |
| SB | Dropdown | Stagebox port (from configuration) | No |
| Source | Text | Source description (Kick, Snare, Voc 1...) | Yes |
| UHF | Text/Dropdown | Wireless system (SLXD, Sennheiser...) | No |
| Mic / Input Dev | Text/Dropdown | Microphone or DI box | No |
| Patched | Checkbox | Is the channel cabled? | No |
| Location | Text/Dropdown | Stage position | No |
| Cable | Text | Cable type/length | No |
| Stand | Text | Stand type | No |
| Notes | Text | Free notes | No |

**Additional Features:**
- Rows can be grouped (e.g. "Drums", "Keys", "Vocals")
- Automatic channel numbering
- Drag & drop for reordering
- Multi-row selection for bulk operations

**Fast Data Entry (Excel-like UX) - CRITICAL:**
- **Tab**: Jumps to next cell in the row
- **Enter**: Jumps to same column in next row (fast column filling)
- **Shift+Enter**: Jumps to previous row
- **Arrow keys**: Navigation between cells
- **Escape**: Cancel editing
- **Inline editing**: Direct typing starts editing (no double-click needed)
- **Auto-complete**: For dropdowns, typing first letters is enough
- **New row**: Enter in last row automatically creates new row
- **Copy/Paste**: Copy multiple cells at once (Ctrl+C/V)
- **Fill Down**: Apply value to multiple selected cells (Ctrl+D)

**Moving Channels (Drag & Drop / Shortcuts) - CRITICAL:**

When moving, the channel number (Ch) stays fixed - only the content moves.

*Example - Move Snare from Ch 2 to Ch 1:*
```
BEFORE:                              AFTER:
Ch 1 │ Kick  │ IOX-D-I1              Ch 1 │ Snare │ IOX-D-I2  ← Content swapped
Ch 2 │ Snare │ IOX-D-I2      →       Ch 2 │ Kick  │ IOX-D-I1  ← Content swapped
Ch 3 │ HiHat │ IOX-D-I3              Ch 3 │ HiHat │ IOX-D-I3
```

*What moves along:*
- Source, Stagebox Port, UHF, Mic, Patched, Location, Cable, Stand, Notes
- Everything except the channel number

*Operation:*
- **Drag & Drop**: Grab row(s) and drag to new position
- **Alt + Arrow up/down**: Move selected row(s)
- **Multi-select**: Shift+Click or Ctrl+Click for multiple rows
- **Move block**: Multiple selected rows are moved as a block

*Example multi-select - Move Drums (Ch 1-4) down:*
```
BEFORE:                              AFTER:
Ch 1 │ Kick   │ Drums                Ch 1 │ Bass  │ Bass      ← Bass moves up
Ch 2 │ Snare  │ Drums                Ch 2 │ Kick  │ Drums
Ch 3 │ HiHat  │ Drums        →       Ch 3 │ Snare │ Drums     ← Drums block
Ch 4 │ Tom    │ Drums                Ch 4 │ HiHat │ Drums        moved
Ch 5 │ Bass   │ Bass                 Ch 5 │ Tom   │ Drums
```

### 4.5 Output Patch List

Analogous to the input list for outputs:

| Column | Type | Description | Required |
|--------|------|-------------|----------|
| Mixer | Dropdown | Mixer assignment | Yes |
| Bus/Aux | Text | Bus name (Mon 1, Mon 2, Main L...) | Yes |
| SB | Dropdown | Stagebox output port | No |
| Destination | Text | Target (Wedge SR, Side Fill, PA L...) | Yes |
| Amp/Processor | Text | Amplifier or processor | No |
| Location | Text | Position on stage | No |
| Cable | Text | Cable type | No |
| Notes | Text | Notes | No |

### 4.6 Graphical Stagebox Overview

Visual representation of all stageboxes:

```
+----------------------------------+
|  STAGEBOX: IOX-D (Drums)         |
|  ================================|
|  INPUTS:                         |
|  [1] Kick      [2] Snare         |
|  [3] Hi-Hat    [4] Tom 1         |
|  [5] Tom 2     [6] Tom 3         |
|  ...                             |
|  ================================|
|  OUTPUTS:                        |
|  [1] Mon Drums [2] -             |
+----------------------------------+
```

**Features:**
- Color coding according to stagebox color
- Occupied ports show Source/Destination
- Free ports are empty/gray
- Click on port opens detail view
- Zoom and pan for large setups

### 4.7 Validation & Checks

Automatic checks:

| Check | Description | Warning/Error |
|-------|-------------|---------------|
| Double allocation | Same stagebox port used multiple times | Error |
| Gaps | Channel numbers not sequential | Warning |
| Missing required fields | Source without value | Warning |
| Unpatched | Stagebox port assigned but not "patched" | Warning |
| Orphan ports | Port occupied but no channel assigned | Warning |

**Status Display:**
- Green checkmark: All checks passed
- Yellow triangle: Warnings present
- Red X: Errors present (as in screenshot)

### 4.8 Templates & Block Presets

| Feature | Description | Priority |
|---------|-------------|----------|
| Project template | Save complete project as template | Must |
| **Block presets** | Insert predefined channel groups as block | **Must** |
| Stagebox template | Reusable stagebox configuration | Should |
| Template library | Central management of all templates | Should |

**Block Presets (Quick Insert) - CRITICAL:**

Block presets are predefined channel groups that can be inserted with one click or shortcut.

*Workflow:*
1. Position cursor in table (or select row)
2. Press shortcut (e.g. `/` or `Ctrl+I`) or button "Insert Preset"
3. Choose preset from list (with search/filter)
4. Block is inserted at cursor position, existing rows move down

*Preset Definition:*
```
Preset: "Standard Drums"
Channels:
  1. Source: "Kick"      | Mic: "Beta 52"    | Location: "Drums"
  2. Source: "Snare Top" | Mic: "SM57"       | Location: "Drums"
  3. Source: "Snare Btm" | Mic: "SM57"       | Location: "Drums"
  4. Source: "Hi-Hat"    | Mic: "KM184"      | Location: "Drums"
  5. Source: "Tom 1"     | Mic: "e604"       | Location: "Drums"
  6. Source: "Tom 2"     | Mic: "e604"       | Location: "Drums"
  7. Source: "Floor Tom" | Mic: "e602"       | Location: "Drums"
  8. Source: "OH L"      | Mic: "C414"       | Location: "Drums"
  9. Source: "OH R"      | Mic: "C414"       | Location: "Drums"
```

*Preset Management:*
- Create own presets (from selected rows)
- Edit/delete presets
- Share presets (team-wide or public)
- Standard library with common setups

**Example Presets (Standard Library):**
- "Drums 5-Piece" (Kick, Snare, HH, 2 Toms, OH)
- "Drums 8-Channel" (extended with Ride, Room)
- "Bass DI+Amp"
- "Acoustic Guitar Stereo"
- "Electric Guitar Stereo"
- "Keys Stereo"
- "Vocal + Spare"
- "Brass Section 4x"
- "String Section"

### 4.9 Real-Time Collaboration

| Feature | Description | Priority |
|---------|-------------|----------|
| Live cursors | See other users in document | Must |
| Real-time sync | Changes immediately visible | Must |
| User list | Who is currently online? | Must |
| Change history | Who changed what? | Should |
| Comments | Comments on individual rows | Could |
| Conflict resolution | For simultaneous editing | Must |

**Conflict Resolution (Specification):**

*Strategy:* Optimistic Concurrency with Last-Write-Wins at row level

| Scenario | Behavior |
|----------|----------|
| 2 users edit different rows | Both changes are applied |
| 2 users edit the same row | Last change wins, previous is overwritten |
| User A deletes row while User B edits it | Row is deleted, User B receives notification |

*Visual Indicators:*
- Colored border around cells being edited by other users
- Tooltip with username on hover
- Brief animation on external changes (cell flashes briefly)

*Technical Basis:*
- Convex's reactive queries guarantee consistent snapshots
- No manual conflict resolution needed
- Transactions for atomic multi-row operations (e.g. insert preset)

### 4.10 Undo/Redo

| Feature | Description | Priority |
|---------|-------------|----------|
| Undo | Undo last action (Ctrl+Z / Cmd+Z) | Must |
| Redo | Restore undone action (Ctrl+Y / Cmd+Shift+Z) | Must |
| History stack | Store last 50 actions per session | Should |
| Bulk undo | Multiple related actions as one unit (e.g. insert preset) | Must |

**Technical Implementation:**
- Command pattern for all table operations
- Undo stack per user and project
- Synchronization with real-time updates (only own actions can be undone)

### 4.11 Import & Export

**CSV Import:**

| Feature | Description | Priority |
|---------|-------------|----------|
| File upload | Upload CSV/Excel file | Must |
| Column mapping | Flexible assignment of CSV columns to system fields | Must |
| Preview | Preview data to be imported before import | Must |
| Validation | Check for errors before import | Must |
| Import mode | Choice between "Replace" and "Add" | Should |

**Import Workflow:**
1. Select CSV file
2. Detect separator (automatic or manual)
3. Configure column mapping (drag & drop)
4. Check preview
5. Fix validation errors
6. Confirm import

**PDF Export:**
- Professional layout for printing
- Options: Inputs only, Outputs only, Both
- Stagebox overview as separate page
- Event header with logo option
- A4 or Letter format
- Landscape for many columns

**CSV Export:**
- Compatible with Excel/Google Sheets
- Separate files for Inputs/Outputs
- UTF-8 encoding with BOM for Excel compatibility

---

## 5. Non-Functional Requirements

### 5.1 Performance
- Load time < 3 seconds
- Real-time updates < 100ms latency
- Support for 200+ channels per project

### 5.2 Compatibility
- Browsers: Chrome, Firefox, Safari, Edge (current versions)
- Responsive: Desktop optimized, tablet usable
- Mobile: View only, no editing

### 5.3 Security
- HTTPS encryption
- User authentication
- Project-based access rights

---

## 6. User Interface Design

### 6.1 Main Views

1. **Dashboard**
   - List of all projects
   - Quick access to recent projects
   - Create new project

2. **Project Editor**
   - Header: Project title, date, status checks
   - Tabs: Inputs | Outputs | Stageboxes | Settings
   - Toolbar: Save, Export, Share, Validate

3. **Stagebox View**
   - Graphical representation
   - Filter by stagebox
   - Print-optimized view

### 6.2 Color Scheme

Based on the screenshot:
- Stagebox colors: Green, Gray, Blue, Orange (configurable)
- Status: Red (Error), Yellow (Warning), Green (OK)
- UI: Neutral, professional, not distracting

---

## 7. Data Model

### 7.1 Entities

```
Project
├── id: UUID
├── title: String
├── date: Date
├── createdAt: DateTime
├── updatedAt: DateTime
├── ownerId: UUID
└── collaborators: UUID[]

Stagebox
├── id: UUID
├── projectId: UUID
├── name: String
├── shortName: String (for port prefix)
├── color: HexColor
├── inputCount: Number
├── outputCount: Number
└── position: {x, y} (for graphical view)

InputChannel
├── id: UUID
├── projectId: UUID
├── order: Number
├── mixer: String
├── channelNumber: Number
├── stageboxPortId: UUID (nullable)
├── source: String
├── uhf: String (nullable)
├── micInputDev: String (nullable)
├── patched: Boolean
├── location: String (nullable)
├── cable: String (nullable)
├── stand: String (nullable)
├── notes: String (nullable)
└── groupId: UUID (nullable)

OutputChannel
├── id: UUID
├── projectId: UUID
├── order: Number
├── mixer: String
├── busName: String
├── stageboxPortId: UUID (nullable)
├── destination: String
├── ampProcessor: String (nullable)
├── location: String (nullable)
├── cable: String (nullable)
└── notes: String (nullable)

Template
├── id: UUID
├── userId: UUID
├── name: String
├── type: "project" | "input_group" | "stagebox"
└── data: JSON

User
├── id: UUID
├── email: String
├── name: String
├── tier: "free" | "pro" | "team"
├── createdAt: DateTime
└── lastLoginAt: DateTime

Mixer
├── id: UUID
├── projectId: UUID
├── name: String
├── type: String (e.g. "Yamaha CL5", "DiGiCo SD12")
├── stereoMode: "linked_mono" | "true_stereo"
├── channelCount: Number
└── designation: String (A, B, C)

StageboxPort
├── id: UUID
├── stageboxId: UUID
├── type: "input" | "output"
├── portNumber: Number
└── label: String (e.g. "IOX-D-I1")

Group
├── id: UUID
├── projectId: UUID
├── name: String (e.g. "Drums", "Keys")
├── color: HexColor
└── order: Number

BlockPreset
├── id: UUID
├── userId: UUID (nullable for system presets)
├── name: String
├── description: String
├── isPublic: Boolean
├── channels: JSON (array of channel definitions)
└── createdAt: DateTime
```

---

## 8. Technology Stack (Recommendation)

### Recommended Stack: Next.js + Convex + Bun

```
┌─────────────────────────────────────────────────────────────────────┐
│  RUNTIME & TOOLING                                                  │
├─────────────────────────────────────────────────────────────────────┤
│  Bun                          Runtime, Package Manager, Bundler     │
│                               - 4x faster than npm install          │
│                               - Native TypeScript support           │
│                               - Faster dev server starts            │
└─────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────┐
│  FRONTEND                                                           │
├─────────────────────────────────────────────────────────────────────┤
│  Next.js 15 (App Router)      Framework, SSR, Routing               │
│  React 19                     UI Library                            │
│  TanStack Table               Excel-like tables with virtualization │
│  Tailwind CSS + shadcn/ui     Styling + UI Components               │
│  Framer Motion                Animations (Drag & Drop)              │
│  react-pdf / @react-pdf       PDF Export                            │
└─────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────┐
│  BACKEND: CONVEX                                                    │
├─────────────────────────────────────────────────────────────────────┤
│  Convex Database              Reactive database with real-time sync │
│  Convex Functions             TypeScript server functions           │
│  Convex Auth                  Authentication (Clerk/Auth.js)        │
│  Convex File Storage          For project exports, logos            │
└─────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────┐
│  INFRASTRUCTURE                                                     │
├─────────────────────────────────────────────────────────────────────┤
│  Vercel                       Frontend Hosting                      │
│  Convex Cloud                 Backend Hosting (or self-hosted)      │
│  Clerk                        Auth Provider (or Convex Auth)        │
└─────────────────────────────────────────────────────────────────────┘
```

### Development with Bun

```bash
# Project Setup
bun create next-app betterpatch-tool
cd betterpatch-tool

# Install dependencies (4x faster than npm)
bun add convex @tanstack/react-table tailwindcss

# Start dev server
bun run dev

# Convex dev server
bun x convex dev
```

### Why Convex?

| Feature | Benefit for BetterPatchTool |
|---------|----------------------------|
| **Reactive Queries** | Changes automatically pushed to all clients - perfect for real-time collaboration |
| **TypeScript-first** | Full type safety from DB schema to frontend |
| **No WebSockets needed** | Convex handles real-time automatically |
| **Consistent Snapshots** | No race conditions during simultaneous editing |
| **Transactions** | Atomic updates for block operations (insert presets, move) |
| **Self-hosting possible** | Open source since Feb 2025 (FSL Apache 2.0) |

### Real-Time Collaboration with Convex

```typescript
// Frontend: Query automatically subscribed to updates
const project = useQuery(api.projects.get, { projectId });
const channels = useQuery(api.channels.list, { projectId });

// Every client sees changes immediately - no manual refresh
// No WebSocket code needed!
```

### Alternative Stacks

**Option B: Next.js + Supabase**
- Supabase Realtime for live updates
- PostgreSQL for complex queries
- Row Level Security for access rights
- More setup, but more control

**Option C: Next.js + Firebase**
- Firestore for real-time
- Good for quick start
- Vendor lock-in, NoSQL limitations

---

## 9. MVP Scope (Phase 1)

For the first version:

**Included:**
- Project management (create, save, load)
- **Mixer configuration** (Stereo mode: Linked Mono / True Stereo)
- Input patch list with all columns + Excel-like navigation
- Output patch list (basic)
- Stagebox configuration
- Tabular stagebox overview
- **Block presets** (Quick Insert with `/` shortcut)
- Basic validation (double allocations)
- CSV export
- PDF export (simple)
- Real-time collaboration
- Dark mode (system detection + toggle)
- User authentication & pricing tiers

**Not included (Phase 2+):**
- Graphical stagebox view with drag & drop
- Complete template library
- Comment function
- Mobile app
- Advanced user roles

---

## 10. Metrics & Success Criteria

| Metric | Goal |
|--------|------|
| Time savings | 50% faster than Excel workflow |
| Error rate | 80% fewer patch errors through validation |
| Adoption | Usable after 5 minutes of learning |
| Performance | < 3s load time, < 100ms sync |

---

## 11. Business Model & Additional Requirements

### Product Type
**SaaS Product** - BetterPatchTool will be offered as a commercial service for audio technicians.

### Pricing Model (Recommendation)

| Tier | Price | Features |
|------|-------|----------|
| Free | 0 EUR/month | 3 projects, 1 user, basic export |
| Pro | 9 EUR/month | Unlimited projects, 5 collaborators, all exports |
| Team | 29 EUR/month | Unlimited projects, unlimited collaborators, share templates |

### Dark Mode
**Must be included in MVP** - Important for low-light situations at FOH and backstage.

- Automatic system setting detection
- Manual toggle
- Dimmed stagebox colors in dark mode
- High-contrast text display

### Mixer Presets (Phase 2)
Import of mixer configurations planned for later version:
- Yamaha CL/QL Series (.clf files)
- Allen & Heath dLive
- DiGiCo SD Series
- Midas M32/X32

---

## 12. Next Steps (Implementation)

After PRD approval:

### Phase 1: Setup
1. Create project structure (monorepo with frontend + backend)
2. Finalize technology stack
3. Implement database schema
4. Set up auth system (Convex Auth with Clerk recommended)

### Phase 2: Core Features
5. Project management (CRUD)
6. Input patch list table
7. Output patch list table
8. Stagebox configuration
9. Tabular stagebox overview

### Phase 3: Collaboration & Export
10. Implement real-time sync
11. Validation engine
12. CSV export
13. PDF export

### Phase 4: Polish
14. Dark mode
15. Responsive design
16. Performance optimization
17. Testing & bug fixes

---

*Document created: 2026-01-14*
*Last updated: 2026-01-14*
