FROM node:22-bookworm-slim

# Build tools for native add-ons + OCR tools
# ocrmypdf orchestrates Tesseract internally and produces searchable PDFs.
# poppler-utils provides pdftotext for text extraction from the OCR output.
RUN apt-get update && apt-get install -y --no-install-recommends \
  python3 make g++ \
  tesseract-ocr tesseract-ocr-tha tesseract-ocr-eng \
  poppler-utils ghostscript ocrmypdf unpaper \
  && rm -rf /var/lib/apt/lists/*

# Enable corepack / pnpm
RUN corepack enable && corepack prepare pnpm@10.32.1 --activate

WORKDIR /app

# ── Workspace manifests (layer-cached until deps change) ─────────────────────
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY back-end/package.json  ./back-end/
# pnpm workspace requires all package.json stubs to be present
COPY front-end/package.json ./front-end/

# Install only back-end workspace dependencies
RUN pnpm install --filter @docai/back-end --frozen-lockfile

# ── Application source ───────────────────────────────────────────────────────
COPY back-end/ ./back-end/

WORKDIR /app/back-end

# Generate Prisma client (dummy URL — generate never connects to DB)
RUN DATABASE_URL=postgresql://build@placeholder/placeholder pnpm prisma:generate

# Compile TypeScript → dist/
RUN pnpm build

EXPOSE 4000

# At runtime: run pending migrations then start the compiled app
CMD ["sh", "-c", "pnpm exec prisma migrate deploy && node dist/main.js"]
