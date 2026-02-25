# Contacts DB Sample

Next.js 16 + Tailwind CSS contacts CRUD app using:

- server actions (no API routes)
- SQLite with Prisma
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

3. Create/update database and Prisma client:

```bash
npm run db:migrate -- --name init
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
