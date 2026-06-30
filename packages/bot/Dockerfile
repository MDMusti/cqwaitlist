FROM node:20-alpine AS builder

WORKDIR /app

COPY package.json package-lock.json ./
COPY packages/shared/package.json packages/shared/
COPY packages/bot/package.json packages/bot/
COPY packages/api/package.json packages/api/

RUN npm ci --workspace=@cleanqueue/shared --workspace=@cleanqueue/bot

COPY packages/shared packages/shared
COPY packages/bot packages/bot
COPY tsconfig.json* ./

RUN npm run build -w @cleanqueue/shared && npm run build -w @cleanqueue/bot

FROM node:20-alpine AS runner

WORKDIR /app
ENV NODE_ENV=production

COPY package.json package-lock.json ./
COPY packages/bot/package.json packages/bot/
COPY packages/shared/package.json packages/shared/

RUN npm ci --omit=dev --workspace=@cleanqueue/shared --workspace=@cleanqueue/bot

COPY --from=builder /app/packages/shared/dist packages/shared/dist
COPY --from=builder /app/packages/bot/dist packages/bot/dist

CMD ["node", "packages/bot/dist/index.js"]
