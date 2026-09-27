# syntax=docker/dockerfile:1

# --------------------------------------------------
# Base
# --------------------------------------------------
FROM node:22-bookworm-slim AS base

WORKDIR /app

# --------------------------------------------------
# Dependencies
# --------------------------------------------------
FROM base AS deps

COPY package*.json ./

RUN --mount=type=cache,target=/root/.npm \
    npm ci

# --------------------------------------------------
# Build
# --------------------------------------------------
FROM base AS builder

COPY --from=deps /app/node_modules ./node_modules

COPY . .

RUN npm run build

# --------------------------------------------------
# Production
# --------------------------------------------------
FROM base AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

RUN groupadd --system --gid 1001 nodejs \
    && useradd --system --uid 1001 --gid nodejs --no-create-home nextjs

COPY --from=builder --chown=nextjs:nodejs /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs

EXPOSE 3000

CMD ["node", "server.js"]
