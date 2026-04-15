# Time Tracker

A web-based time-tracking application where users log what they're doing throughout the day. Tasks are organized under projects and categories, each with an HSL color. The main UI is a calendar view with colored blocks representing time intervals.

## Prerequisites

- Node.js 20+
- npm 10+

## Setup

```bash
# Install dependencies
npm install

# Run database migration (creates the SQLite file)
cd packages/server
npx prisma migrate deploy

# Generate Prisma client
npx prisma generate

# Seed sample data
npm run db:seed

cd ../..
```

## Development

```bash
# Start both server and web in parallel
npm run dev
```

- Server: http://localhost:3001
- Web: http://localhost:5173
- OpenAPI spec: http://localhost:3001/api/doc

## Scripts

| Script | Description |
|--------|-------------|
| `npm run dev` | Start server + web dev servers concurrently |
| `npm run build` | Build all packages (shared → server → web) |
| `npm run lint` | Lint all TypeScript source files |
| `npm test` | Run all tests |
| `npm run test:watch` | Run tests in watch mode |
| `npm run test:server` | Run server tests only |
| `npm run test:web` | Run web tests only |
| `npm run test:coverage` | Run tests with coverage report |
| `npm run db:migrate` | Apply pending database migrations |
| `npm run db:seed` | Seed the database with sample data |
| `npm run db:studio` | Open Prisma Studio (database GUI) |

## Project Structure

```
time-tracker/
  package.json              # npm workspace root
  tsconfig.json             # TypeScript project references
  tsconfig.base.json        # Shared TypeScript config
  vitest.workspace.ts       # Vitest workspace config
  packages/
    shared/                 # Shared Zod schemas and TypeScript types
      src/
        schemas/            # Zod schemas (category, project, task, intake)
    server/                 # Hono backend
      src/
        app.ts              # Hono app composition
        index.ts            # Server entry point
      prisma/
        schema.prisma       # Database schema
        seed.ts             # Seed script
      tests/
        unit/               # Service-layer unit tests
        integration/        # API route integration tests
    web/                    # React frontend
      src/
        main.tsx            # Entry point
      index.html
      tests/
        components/         # React Testing Library component tests
```

## Tech Stack

- **Backend**: Node.js, Hono, `@hono/zod-openapi`, Prisma, SQLite
- **Frontend**: React 18, Vite, React Router, React Query
- **Shared**: Zod schemas (single source of truth for validation and types)
- **Testing**: Vitest, React Testing Library, MSW
- **Language**: TypeScript throughout
