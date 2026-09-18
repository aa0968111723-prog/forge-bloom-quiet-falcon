# syntax=docker/dockerfile:1
# Zeabur / any Node host: long-running Nitro node-server.
# Do NOT run `npm run build` here — that script also migrates, and
# postgresql.zeabur.internal is not reachable during the image build.

FROM node:22-bookworm-slim AS build
WORKDIR /app

ENV NODE_ENV=production
ENV NITRO_PRESET=node-server
ENV NODE_OPTIONS=--max-old-space-size=1536

COPY package.json package-lock.json ./
RUN npm ci --include=dev

COPY . .
RUN npx vite build

FROM node:22-bookworm-slim AS runtime
WORKDIR /app

ENV NODE_ENV=production
ENV HOST=0.0.0.0
ENV PORT=8080

COPY package.json package-lock.json ./
RUN npm ci --omit=dev

COPY --from=build /app/.output ./.output
COPY --from=build /app/migrations ./migrations
COPY --from=build /app/scripts/migrate.mjs ./scripts/migrate.mjs

EXPOSE 8080

CMD ["sh", "-c", "node scripts/migrate.mjs && node .output/server/index.mjs"]
