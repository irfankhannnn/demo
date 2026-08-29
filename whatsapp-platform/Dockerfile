# Build stage
FROM node:20-slim AS builder

WORKDIR /app

# Build dependencies for native modules (Baileys uses libsignal/node-pre-gyp)
RUN apt-get update && apt-get install -y \
    python3 \
    make \
    g++ \
    libssl-dev \
    git \
    && rm -rf /var/lib/apt/lists/*

# Copy dependency files and npm config
COPY package.json package-lock.json .npmrc ./

# Copy patches BEFORE npm install so postinstall can apply them
COPY patches/ ./patches/

# Install dependencies (postinstall will apply patches)
RUN npm ci --omit=dev

# Copy source code
COPY src ./src

# Runtime stage
FROM node:20-slim

WORKDIR /app

# Copy dependencies and source from builder
COPY package.json package-lock.json .npmrc ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/src ./src
COPY --from=builder /app/patches ./patches
COPY scripts/healthcheck.js ./scripts/healthcheck.js

ENV NODE_ENV=production
# Default port — can be overridden by env or ECS task definition
ENV PORT=3003

EXPOSE 3003

HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 \
  CMD node scripts/healthcheck.js || exit 1

CMD ["node", "src/index.js"]
