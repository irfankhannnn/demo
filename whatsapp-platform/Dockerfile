FROM node:20-slim

WORKDIR /app

# Build dependencies for native modules (Baileys uses libsignal/node-pre-gyp)
RUN apt-get update && apt-get install -y \
    python3 \
    make \
    g++ \
    libssl-dev \
    curl \
    && rm -rf /var/lib/apt/lists/*

COPY package*.json ./

# Install all dependencies (including patch-package for Baileys patches)
RUN npm install --omit=dev

# Apply patches after install
COPY patches/ ./patches/
RUN npx patch-package

COPY src ./src

ENV NODE_ENV=production
# Default port — can be overridden by env or ECS task definition
ENV PORT=3003

EXPOSE 3003

HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 \
  CMD curl -f http://localhost:${PORT}/health || exit 1

CMD ["node", "src/index.js"]
