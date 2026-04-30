FROM oven/bun:1-alpine

RUN apk add --no-cache postgresql-client

WORKDIR /app

# install deps first for layer caching
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile

# copy source + build files
COPY tsconfig.json biome.json ./
COPY src ./src
COPY drizzle ./drizzle
COPY scripts ./scripts
COPY docker/entrypoint.sh /app/docker/entrypoint.sh

RUN chmod +x /app/docker/entrypoint.sh

# default command overridden by docker-compose service
CMD ["bun", "run", "src/api/index.ts"]
