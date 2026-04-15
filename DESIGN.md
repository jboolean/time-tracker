# Time Tracker — Design Document

## Overview

A web-based time-tracking application where users log what they're doing throughout the day. Tasks are organized under projects and categories, each category carrying a color. The main UI is a calendar view filled with colored blocks representing time intervals, giving an at-a-glance visual of how time was spent.

An AI integration is planned for a future phase (out of scope for this document) that will process free-text input into structured tasks, match them to projects/categories, and generate summaries.

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Backend runtime | Node.js (LTS) |
| Backend framework | **Hono** + `@hono/zod-openapi` |
| Database | SQLite (file-based, zero setup — swap to PostgreSQL for production later if needed) |
| ORM | Prisma |
| Frontend framework | React 18+ |
| Frontend bundler | Vite |
| Language | TypeScript (shared across frontend and backend) |
| Monorepo structure | npm workspaces (`packages/server`, `packages/web`, `packages/shared`) |
| API client | Hono RPC client (`hc<AppType>`) for end-to-end type safety, plus auto-generated OpenAPI spec for external consumers |
| Testing | Vitest (unit + integration), Hono test client (API tests), React Testing Library (component tests) |

---

## Monorepo Layout

```
time-tracker/
  package.json              # workspace root
  README.md                 # setup instructions, dev workflow, project overview
  packages/
    shared/                 # shared Zod schemas, types, constants
      src/
        schemas/            # Zod schemas (single source of truth for validation + types)
        constants/
    server/
      src/
        routes/             # Hono route definitions with zod-openapi
          categories.ts
          projects.ts
          tasks.ts
          intake.ts
        services/           # business logic
        middleware/          # error handling, logging
        app.ts              # Hono app composition
        index.ts            # server entry point
      prisma/
        schema.prisma
        migrations/
      vitest.config.ts
      tests/
        unit/               # service-layer unit tests
        integration/        # API route integration tests
    web/
      src/
        components/         # reusable UI components
        pages/              # route-level page components
        hooks/              # custom React hooks
        api/                # Hono RPC client setup
        styles/
      index.html
      vite.config.ts
      vitest.config.ts
      tests/
        components/         # component tests with React Testing Library
```

---

## Data Model

### Entity Relationship

```
Category (has color, optional parent_id → Category)
  └── Project (belongs to one Category)
       └── Task (belongs to one Project, has start/end time)
```

### Database Schema (Prisma)

```prisma
datasource db {
  provider = "sqlite"
  url      = env("DATABASE_URL") // e.g. "file:./dev.db"
}

generator client {
  provider = "prisma-client-js"
}

model Category {
  id          String     @id @default(uuid())
  name        String
  hue         Float      // 0-360, maps directly to color wheel angle
  saturation  Float      @default(70) // 0-100
  lightness   Float      @default(55) // 0-100
  parentId    String?    @map("parent_id")
  parent      Category?  @relation("CategoryNesting", fields: [parentId], references: [id])
  children    Category[] @relation("CategoryNesting")
  description String?
  keywords    String     @default("[]") // JSON array string (SQLite has no array type)
  projects    Project[]
  createdAt   DateTime   @default(now()) @map("created_at")
  updatedAt   DateTime   @updatedAt @map("updated_at")

  @@map("categories")
}

model Project {
  id          String   @id @default(uuid())
  name        String
  description String?
  keywords    String   @default("[]") // JSON array string (SQLite has no array type)
  isDefault   Boolean  @default(false) @map("is_default")
  categoryId  String   @map("category_id")
  category    Category @relation(fields: [categoryId], references: [id])
  tasks       Task[]
  archived    Boolean  @default(false)
  createdAt   DateTime @default(now()) @map("created_at")
  updatedAt   DateTime @updatedAt @map("updated_at")

  @@map("projects")
}

model Task {
  id          String    @id @default(uuid())
  title       String?
  description String?
  rawInput    String?   @map("raw_input")
  projectId   String    @map("project_id")
  project     Project   @relation(fields: [projectId], references: [id])
  startTime   DateTime  @map("start_time")
  endTime     DateTime? @map("end_time") // null = currently active
  createdAt   DateTime  @default(now()) @map("created_at")
  updatedAt   DateTime  @updatedAt @map("updated_at")

  @@map("tasks")
}
```

**Key decisions:**
- **SQLite** — zero-install, file-based. The db file lives at `packages/server/prisma/dev.db` (gitignored). Easily swappable to PostgreSQL later by changing the Prisma datasource provider.
- **`keywords` as JSON string** — SQLite has no native array column type. Stored as a JSON-serialized string (`"[]"`), parsed/serialized in the service layer. Zod schemas accept `string[]` and the service handles the conversion.
- **HSL color model** — Color is stored as three separate columns: `hue` (0-360), `saturation` (0-100), `lightness` (0-100). This gives us:
  - **Hue = position on the color wheel** — dragging a category around the wheel updates its hue directly. No separate `position` field needed.
  - **Distance between categories** is just the angular difference in hue — useful for the AI later and for ensuring visual distinctness.
  - **Saturation/lightness** can differentiate subcategories from parents (e.g., child categories slightly lighter/desaturated) or let users fine-tune.
  - CSS-native: `hsl(${hue}, ${saturation}%, ${lightness}%)` renders directly, no conversion needed.
- Single level of category nesting enforced at the application layer (parentId is nullable, but a child cannot itself be a parent — validated in the service layer).
- A category can have one default project (`isDefault`), used as fallback when no specific project is matched.
- Only one task can have `endTime = null` at a time, enforced by the service layer.

---

## API Design (Hono + Zod OpenAPI Routes)

All routes prefixed with `/api`. Each route is defined using `@hono/zod-openapi`'s `createRoute()` with Zod schemas from `packages/shared` for request/response validation and type inference.

### Categories — `packages/server/src/routes/categories.ts`

| Method | Path | Description |
|--------|------|-------------|
| GET | `/categories` | List all categories (flat, includes parent relationship) |
| POST | `/categories` | Create a category |
| PATCH | `/categories/:id` | Update category (name, hue, saturation, lightness, parentId) |
| DELETE | `/categories/:id` | Delete category (fails if has projects) |

### Projects — `packages/server/src/routes/projects.ts`

| Method | Path | Description |
|--------|------|-------------|
| GET | `/projects` | List projects (filterable by categoryId) |
| POST | `/projects` | Create a project |
| PATCH | `/projects/:id` | Update project |
| DELETE | `/projects/:id` | Delete project (fails if has tasks) |

### Tasks — `packages/server/src/routes/tasks.ts`

| Method | Path | Description |
|--------|------|-------------|
| GET | `/tasks` | List tasks (filterable by date range, projectId, categoryId) |
| GET | `/tasks/active` | Get the currently active (open-ended) task, if any |
| POST | `/tasks` | Create a task (with explicit project, start/end) |
| PATCH | `/tasks/:id` | Update a task |
| DELETE | `/tasks/:id` | Delete a task |
| POST | `/tasks/:id/end` | End the currently active task (sets endTime to now) |

### Intake — `packages/server/src/routes/intake.ts`

| Method | Path | Description |
|--------|------|-------------|
| POST | `/intake` | Submit free-text input. For now (pre-AI): creates a task with rawInput stored, under a user-selected or default project, with startTime = now. Closes any currently active task first. |

The intake route is the main integration point. Future AI processing, webhooks, and external integrations all funnel through this endpoint.

### OpenAPI Spec

The `@hono/zod-openapi` plugin auto-generates an OpenAPI 3.1 spec from the route definitions. Served at `GET /api/doc` (JSON). This is available for external consumers; the frontend uses Hono's RPC client instead.

---

## Frontend Architecture

### Routes

| Path | Page | Description |
|------|------|-------------|
| `/` | CalendarPage | Default view — color-block calendar |
| `/categories` | CategoriesPage | Color wheel category management |
| `/projects` | ProjectsPage | Project list management |

### API Client — Hono RPC

The frontend uses Hono's `hc<AppType>()` typed client. The server exports its app type from `packages/server/src/app.ts`, and the web package imports it as a type-only import. This gives full end-to-end type safety (request params, body, response) with zero code generation.

```ts
// packages/web/src/api/client.ts
import { hc } from "hono/client";
import type { AppType } from "@time-tracker/server/app";

export const api = hc<AppType>("/api");
```

### Persistent Bottom Bar

A fixed-position bar at the bottom of every page containing:
1. **Text input** — placeholder: "What are you doing?" — submits to `POST /api/intake`
2. **End Task button** — visible only when there is an active task — calls `POST /api/tasks/:id/end`

This bar is rendered in the app shell layout, outside of route components, so it persists across navigation.

### Calendar Page

- Default view: current week (7-day grid, switchable to month).
- Each day column spans the full vertical height of the viewport.
- Within each day, tasks render as vertically stacked colored blocks proportional to their duration, colored by category.
- Blocks show truncated task title on hover/click.
- The calendar uses the full viewport minus the nav bar and bottom bar.
- Clicking a block opens a detail popover for editing.

### Categories Page — Color Wheel

- A large circular color wheel centered on the page.
- Each category is a draggable node positioned around the wheel's circumference at its `hue` angle (0-360).
- The node's color is its HSL value: `hsl(hue, saturation%, lightness%)`.
- Subcategories render as smaller nodes visually connected to their parent with a line/arc. Subcategories could default to the parent's hue with reduced saturation or shifted lightness.
- A floating "+" button to create a new category (modal with name and optional parent selector).
- Dragging a node around the wheel updates its `hue`, persisted via `PATCH /api/categories/:id`.

### Projects Page

- A list/card view of all projects, grouped by category (category color as accent).
- Each card shows: project name, description, category, default badge if applicable.
- Inline editing of name and description.
- "New Project" button opens a creation form (name, description, category selector, keywords).
- Future: archive toggle.

---

## Testing Architecture

### Philosophy

- **Vitest** as the unified test runner across all packages (fast, native ESM, compatible with Vite config).
- Tests live alongside the code they test, in `tests/` directories within each package.
- Favor integration tests for API routes (high coverage, low maintenance) and component tests for UI (user-centric, not implementation-centric).

### Backend Testing

#### Unit Tests (`packages/server/tests/unit/`)
- Test service-layer business logic in isolation.
- Mock Prisma client using `vitest.mock()` — services accept a Prisma client via dependency injection.
- Cover: nesting validation, active task enforcement, default project resolution, intake processing logic.

#### Integration Tests (`packages/server/tests/integration/`)
- Test full HTTP request → response cycle using Hono's built-in test client (`app.request()`).
- No real HTTP server needed — Hono's test client calls the app directly, making tests fast and deterministic.
- Use a separate SQLite test database file (`test.db`) with Prisma migrations applied before the test suite.
- Each test file resets relevant tables between tests using a helper (DELETE FROM, fast with SQLite).
- Cover: all CRUD routes, error responses (404, 409, 422), query filtering, intake → task creation flow.

```ts
// Example: integration test using Hono test client
import { app } from "../../src/app";

test("POST /api/categories creates a category", async () => {
  const res = await app.request("/api/categories", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name: "Creative Work", color: "#FF5733", position: 45 }),
  });
  expect(res.status).toBe(201);
  const body = await res.json();
  expect(body.name).toBe("Creative Work");
});
```

### Frontend Testing

#### Component Tests (`packages/web/tests/components/`)
- Use **React Testing Library** + **Vitest** + **jsdom**.
- Test components from the user's perspective (render, interact, assert on visible output).
- Mock API calls using **MSW** (Mock Service Worker) to intercept fetch requests with realistic responses.
- Cover: bottom bar input submission, end task button visibility, calendar block rendering, category wheel interactions, project card editing.

### Test Scripts

```json
{
  "test": "vitest run --workspace",
  "test:watch": "vitest --workspace",
  "test:server": "vitest run --project server",
  "test:web": "vitest run --project web",
  "test:coverage": "vitest run --workspace --coverage"
}
```

### Test Database

- Tests use a separate SQLite file (`packages/server/prisma/test.db`, gitignored).
- Set via `DATABASE_URL=file:./test.db` in test environment.
- A `test:setup` script runs `prisma migrate deploy` against the test database.
- No Docker or external services required.

---

## Development Phases & Task Streams

The project is split into parallel task streams that can be assigned to independent worker agents. Dependencies between streams are noted.

### Phase 1: Foundation

#### Stream A — Project Scaffolding & README
- Initialize npm workspace monorepo
- Set up `packages/shared`, `packages/server`, `packages/web`
- Configure TypeScript (`tsconfig.json` for each package with project references)
- Configure Vite for the web package
- Configure Hono + `@hono/zod-openapi` for the server package
- Add dev scripts (`dev`, `build`, `lint`, `test`) to root `package.json`
- Set up Prettier and ESLint
- Write `README.md` with: project overview, prerequisites (Node only), setup instructions (`npm install`, `npx prisma migrate deploy`, `npm run dev`), available scripts, project structure overview
- **Verify README instructions work** end-to-end from a clean clone

#### Stream B — Database & ORM
- Set up Prisma in `packages/server`
- Write the schema (Categories, Projects, Tasks as defined above)
- Generate initial migration
- Seed script with sample categories, projects, and tasks
- **Depends on:** Stream A (needs workspace structure)

### Phase 2: Backend API

#### Stream C — Category & Project Routes
- Zod schemas for Category and Project in `packages/shared`
- Hono OpenAPI route definitions for categories and projects
- `CategoriesService` + `ProjectsService` (CRUD + nesting validation + default project logic)
- Error handling middleware (Zod validation errors, not-found, conflict)
- **Depends on:** Streams A, B

#### Stream D — Task & Intake Routes
- Zod schemas for Task and Intake in `packages/shared`
- Hono OpenAPI route definitions for tasks and intake
- `TasksService` + `IntakeService` (CRUD + date-range queries + active task enforcement + close-and-create flow)
- **Depends on:** Streams A, B

#### Stream E — Backend Tests
- Vitest configuration for the server package
- Test database setup helper (migrate, reset between tests)
- Integration tests for all routes defined in Streams C and D
- Unit tests for service-layer business logic
- **Depends on:** Streams C, D

### Phase 3: Frontend

#### Stream F — App Shell & Routing
- Vite + React entry point
- React Router setup (3 routes)
- App shell layout: top nav bar, route outlet, persistent bottom bar
- Bottom bar component with text input and end-task button
- Hono RPC client setup (`hc<AppType>`)
- React Query integration for data fetching/caching
- Vite proxy config to forward `/api` to the backend dev server
- **Depends on:** Streams C, D (needs server app type export)

#### Stream G — Calendar Page
- Week/month grid layout (full viewport)
- Fetch tasks for visible date range
- Render colored time blocks proportional to duration
- Block hover/click detail popover
- **Depends on:** Stream F

#### Stream H — Categories Page (Color Wheel)
- Circular layout with draggable category nodes
- Color derivation from angular position
- Parent-child visual connections
- Create category modal
- Drag-to-reposition with PATCH on drop
- **Depends on:** Stream F

#### Stream I — Projects Page
- Category-grouped card list
- Inline editing
- Create project form
- **Depends on:** Stream F

### Phase 4: Polish & Integration

#### Stream J — Frontend Tests
- Vitest + React Testing Library + jsdom configuration for the web package
- MSW setup for API mocking
- Component tests for: bottom bar, calendar blocks, color wheel interactions, project cards
- **Depends on:** Streams G, H, I

#### Stream K — End-to-End Flow & Polish
- Wire bottom bar intake to backend, handle active task state
- Loading states, error toasts
- Responsive layout adjustments
- Final README review — verify all instructions still work
- **Depends on:** Streams G, H, I, J

---

## Key Technical Decisions

1. **Hono + `@hono/zod-openapi`** — Zod schemas are the single source of truth for runtime validation, TypeScript types, and OpenAPI spec generation. No decorators, no code generation step, no drift between types and validation.
2. **Hono RPC client (`hc`)** — The frontend imports the server's app type and gets fully typed API calls with zero code generation. Request params, bodies, and responses are all inferred. The OpenAPI spec is still generated for external consumers / future webhooks.
3. **Zod schemas in `packages/shared`** — Both frontend and backend import the same schemas for validation and type inference, ensuring the contract is enforced on both sides.
4. **Prisma + SQLite** — zero-install database, type-safe ORM with auto-generated migrations. SQLite file is gitignored; swap to PostgreSQL later by changing one line in `schema.prisma`.
5. **Vite** for fast HMR and modern ESM-native bundling on the frontend.
6. **Vitest** as the unified test runner — shares Vite's config and transform pipeline, fast watch mode, native ESM.
7. **React Query** (`@tanstack/react-query`) for server state management — handles caching, refetching, and optimistic updates for the calendar and management pages.
8. **Single active task constraint** enforced in the service layer (not DB constraint) to allow more flexible error messaging and future multi-task support.
9. **HSL color model** — hue doubles as the color wheel position (0-360 degrees). Distance between categories is just `abs(hueA - hueB)`. Saturation and lightness allow subcategory differentiation and user customization.
10. **Intake as the universal entry point** — all task creation from user input (text box, webhooks, future AI) goes through the intake route, making it the natural place to plug in AI processing later.
11. **No auth for v1** — single-user app. Auth can be layered in later via Hono middleware.

---

## Future (Out of Scope)

- AI integration: process raw intake text into structured task (title, description, project/category matching via keywords)
- Webhooks: external services POST to `/api/intake` with context
- Project archiving
- Multi-user support / authentication
- Task editing directly from calendar (drag to resize, move between days)
- Analytics / reporting views
