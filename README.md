# Journal

Journal is an npm-workspaces monorepo containing the web application and API.

## Structure

```text
apps/
  web/    Next.js application
  api/    NestJS API and Prisma schema
packages/ # shared libraries (add when needed)
```

## Requirements

- Node.js 20.19 or newer
- npm 10 or newer
- Docker (for the local PostgreSQL database)

## Setup

Install all workspace dependencies from the repository root:

```bash
npm install
cp apps/web/.env.example apps/web/.env
cp apps/api/.env.example apps/api/.env
npm run db:up
npm run prisma:migrate
npm run prisma:seed
```

Keep existing `.env` files when they are already configured.

## Development

Run the applications in separate terminals:

```bash
npm run dev:web
npm run dev:api
```

The web app runs on `http://localhost:3000`. The API uses the port configured in `apps/api/.env` (default `3001`).

## Quality checks

```bash
npm run lint
npm test
npm run build
```

Commands can also target one workspace directly:

```bash
npm run test --workspace @journal/api
npm run build --workspace @journal/web
```

Add reusable code under `packages/` only when both applications need it; keeping app-specific code inside its owning workspace avoids premature coupling.
