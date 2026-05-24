FROM node:22-bookworm-slim

# ── System dependencies ───────────────────────────────────────────────────────
# chromium: PDF generation via puppeteer-core
# fonts-thai-tlwg: Thai character rendering in Chromium
# fonts-noto-color-emoji: emoji support
RUN apt-get update && apt-get install -y --no-install-recommends \
    chromium \
    fonts-thai-tlwg \
    fonts-noto-color-emoji \
  && rm -rf /var/lib/apt/lists/*

# Enable corepack / pnpm
RUN corepack enable && corepack prepare pnpm@10.32.1 --activate

WORKDIR /app

# ── Workspace manifests (layer-cached until deps change) ─────────────────────
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY back-end/package.json  ./back-end/
COPY front-end/package.json ./front-end/

# Install only front-end workspace dependencies
RUN pnpm install --filter @docai/front-end --frozen-lockfile

# ── Application source ───────────────────────────────────────────────────────
COPY front-end/ ./front-end/

WORKDIR /app/front-end

# NEXT_PUBLIC_* vars are baked into the JS bundle at build time.
# Pass real values as build-args in easypanel (Build → Build Arguments).
ARG NEXT_PUBLIC_API_URL=http://localhost:4000/api/v1
ARG NEXT_PUBLIC_APP_URL=http://localhost:3000
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
ENV NEXT_PUBLIC_APP_URL=$NEXT_PUBLIC_APP_URL
ENV NEXT_TELEMETRY_DISABLED=1

RUN pnpm build

EXPOSE 3000

ENV PORT=3000
ENV HOSTNAME=0.0.0.0
# Tell puppeteer-core where Chromium lives in this image
ENV CHROME_EXECUTABLE_PATH=/usr/bin/chromium

CMD ["pnpm", "start"]
