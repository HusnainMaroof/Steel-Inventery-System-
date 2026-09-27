# syntax=docker/dockerfile:1

# --------------------------------------------------
# Base
# --------------------------------------------------
FROM node:22-bookworm-slim AS base

WORKDIR /app

RUN apt-get update \
    && apt-get install -y --no-install-recommends openssl \
    && rm -rf /var/lib/apt/lists/*

# --------------------------------------------------
# Development dependencies
# Used only for building the application
# --------------------------------------------------
FROM base AS deps

COPY package*.json ./

RUN --mount=type=cache,target=/root/.npm \
    npm ci


# --------------------------------------------------
# Production dependencies
# Only dependencies required at runtime
# --------------------------------------------------
FROM base AS prod-deps

COPY package*.json ./

RUN --mount=type=cache,target=/root/.npm \
    npm ci --omit=dev


# --------------------------------------------------
# Build
# --------------------------------------------------
FROM base AS builder

COPY --from=deps /app/node_modules ./node_modules

COPY . .

# Generate Prisma Client
RUN npx prisma generate

# Build NestJS
RUN npm run build


# --------------------------------------------------
# Production
# --------------------------------------------------
FROM base AS runner

WORKDIR /app

ENV NODE_ENV=production

# Create non-root user
RUN groupadd --system --gid 1001 nodejs \
    && useradd --system --uid 1001 --gid nodejs --no-create-home nestjs

# Production-only dependencies
COPY --from=prod-deps /app/node_modules ./node_modules

# Prisma schema and migrations
COPY --from=builder /app/prisma ./prisma

# Generated Prisma client + engines
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma

# Compiled NestJS application
COPY --from=builder /app/dist ./dist

# Package metadata
COPY --from=builder /app/package.json ./package.json

USER nestjs

EXPOSE 4000

CMD ["node", "dist/main.js"]