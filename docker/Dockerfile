# Stage 1: Build
FROM node:22-alpine AS builder
RUN corepack enable
WORKDIR /app
COPY pnpm-workspace.yaml pnpm-lock.yaml package.json tsconfig.json ./
COPY packages/shared/package.json packages/shared/
COPY packages/server/package.json packages/server/
COPY packages/client/package.json packages/client/
RUN pnpm install --frozen-lockfile
COPY packages/ packages/
RUN pnpm -r build

# Stage 2: Production
FROM node:22-alpine
RUN corepack enable
WORKDIR /app
COPY --from=builder /app/pnpm-workspace.yaml /app/package.json /app/pnpm-lock.yaml ./
COPY --from=builder /app/packages/shared/package.json packages/shared/
COPY --from=builder /app/packages/shared/dist packages/shared/dist/
COPY --from=builder /app/packages/server/package.json packages/server/
COPY --from=builder /app/packages/server/dist packages/server/dist/
COPY --from=builder /app/packages/client/dist packages/client/dist/
RUN pnpm install --frozen-lockfile --prod
ENV NODE_ENV=production
EXPOSE 3000
CMD ["node", "packages/server/dist/index.js"]
