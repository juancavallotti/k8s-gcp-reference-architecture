FROM node:20-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

FROM node:20-alpine AS builder
WORKDIR /app
ENV APP_DB_ENGINE=sqlite
ENV SQLITE_DATABASE_URL=file:../data/contacts.db
ENV POSTGRES_DATABASE_URL=postgresql://postgres:example@postgres-rw:5432/postgres?schema=public
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run db:generate && npm run build

FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV APP_DB_ENGINE=sqlite
ENV SQLITE_DATABASE_URL=file:../data/contacts.db
ENV POSTGRES_DATABASE_URL=postgresql://postgres:example@postgres-rw:5432/postgres?schema=public

COPY --from=builder /app/public ./public
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static

RUN mkdir -p prisma/data

EXPOSE 3000

CMD ["sh", "-c", "if [ \"$APP_DB_ENGINE\" = \"postgres\" ]; then npx prisma migrate deploy --schema prisma/postgres/schema.prisma; else npx prisma migrate deploy --schema prisma/sqlite/schema.prisma; fi && node server.js"]
