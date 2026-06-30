# CleanQueue Bot — Developer Setup

Modular TypeScript Discord bot (Phase 1 core framework).

## Prerequisites

- Node.js 20+
- Discord Application with Bot Token ([Developer Portal](https://discord.com/developers/applications))
- Bot invite scope: `bot` + `applications.commands`
- Optional: Docker for local Postgres + Redis

## Quick Start

From the **repository root**:

```bash
cp .env.example .env
# Fill BOT_TOKEN, CLIENT_ID, GUILD_ID, etc.

npm install
npm run build
npm run start:bot
```

For local development with hot reload:

```bash
npm run dev:bot
```

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `BOT_TOKEN` | yes | Discord bot token |
| `CLIENT_ID` | yes | Application ID |
| `GUILD_ID` | recommended | Guild ID for dev command registration |
| `DATABASE_URL` | no (Phase 1) | PostgreSQL connection string |
| `REDIS_URL` | no (Phase 1) | Redis connection string |
| `LOG_LEVEL` | no | `debug`, `info`, `warn`, `error` |

## Architecture

```
src/
├── index.ts              # Entry point, module registration
├── config/               # Zod env validation
├── core/
│   ├── Client.ts         # Extended Discord.js client
│   ├── CommandLoader.ts  # Registers slash commands
│   ├── EventLoader.ts    # Registers event handlers
│   ├── ModuleRegistry.ts # Module lifecycle
│   └── logger.ts         # Pino structured logging
└── modules/
    ├── core/             # Phase 1 — /cleanqueue status
    ├── moderation/       # Phase 2 placeholder
    ├── verification/     # Phase 2 placeholder
    ├── tickets/          # Phase 2 placeholder
    ├── logging/          # Phase 2 placeholder
    ├── voice/            # Phase 3 placeholder
    └── community/        # Phase 3 placeholder
```

## Proof of Life

After starting the bot, run `/cleanqueue status` on your Discord server. It shows version, uptime, infra config, and module roadmap status.

Slash commands register automatically on `ready`.

## Local Infrastructure

```bash
docker compose up -d
npm run db:generate
npm run db:push
```

## Build

```bash
npm run build -w @cleanqueue/bot
node packages/bot/dist/index.js
```

## Docker (optional)

```bash
docker build -f packages/bot/Dockerfile -t cleanqueue-bot .
```
