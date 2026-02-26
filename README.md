# Contacts DB Sample

Next.js 16 + Tailwind CSS contacts CRUD app using:

- server actions (no API routes)
- SQLite or Postgres with Prisma
- 3-layer architecture:
  - Presentation: `src/app`, `src/components`, `src/actions`
  - Application: `src/application`
  - Persistence: `src/persistence`

Contacts fields:

- `name`
- `phone`
- `email`

## Local setup

1. Install dependencies:

```bash
npm install
```

2. Configure environment:

```bash
cp .env.example .env
```

Key env vars:

- `APP_DB_ENGINE=sqlite|postgres`
- `SQLITE_DATABASE_URL` for local SQLite
- `POSTGRES_DATABASE_URL` for PostgreSQL deployments

3. Create/update SQLite database and Prisma clients:

```bash
npm run db:migrate -- --name init
npm run db:generate
```

4. Run the app:

```bash
npm run dev
```

Open `http://localhost:3000`.

## Validation

Run lint:

```bash
npm run lint
```

Run production build:

```bash
npm run build
```

## Docker

Build image:

```bash
docker build -t contacts-db-sample .
```

Run container:

```bash
docker run --rm -p 3000:3000 -v "$(pwd)/prisma/data:/app/prisma/data" contacts-db-sample
```

The container starts by running `prisma migrate deploy`, then starts Next.js.

Use Postgres in Docker/K8s by overriding env vars:

```bash
-e APP_DB_ENGINE=postgres \
-e POSTGRES_DATABASE_URL="postgresql://postgres:example@postgres-rw:5432/postgres?schema=public"
```

## GitHub repository

Target remote:

```bash
git@github.com:juancavallotti/contacts-db-sample.git
```

Suggested push flow:

```bash
git init
git remote add origin git@github.com:juancavallotti/contacts-db-sample.git
git add .
git commit -m "feat: create contacts CRUD app with Next.js, server actions and SQLite"
git branch -M main
git push -u origin main
```
