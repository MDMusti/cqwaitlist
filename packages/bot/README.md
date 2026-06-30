# CleanQueue Bot — Developer Setup

Modular TypeScript Discord bot — **Best-of Community Platform** (MEE6, Wick, Dyno, Carl-bot, Ticket Tool, VoiceMaster, Arcane inspiriert).

## Feature-Übersicht

| Modul | Features |
|-------|----------|
| **Verification** | Multi-Step (Regeln → Captcha), Account-Alter, Channel-Restore nach Verify |
| **Moderation** | AutoMod (Invites, Spam, Mentions, CAPS, Wiederholung), Warn/Mute/Kick/Ban, `/mod history` & `/mod note`, DM bei Warn mit Case-ID, Quarantine-Option |
| **Anti-Raid** | Join-Rate-Erkennung (5/10s), Verify-Lockdown, Mod-Alert |
| **Tickets** | Modal-Intake, Claim, Close mit Grund, Transcript, 1–5★ Bewertung |
| **Community** | XP/Levels, `/rank` mit Unicode-Balken, Level-Up Channel, Rollen bei L5/L10/L25, Welcome & Leave, `/poll`, `/giveaway start` |
| **Voice** | Temp-Voice + VoiceMaster Control Panel (Lock, Hide, Limit, Rename, Trust, Block, Bitrate) |
| **Logging** | Einheitliches Audit-Log (Mod, Member, Message, Ticket, Security) |
| **Games** | Trivia, Coinflip (erweiterbar) |
| **Core** | `/setup server`, `/cleanqueue help|modules|profile|status` |

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
| `DATABASE_URL` | no | PostgreSQL (JSON-Fallback aktiv) |
| `REDIS_URL` | no | Redis connection string |
| `LOG_LEVEL` | no | `debug`, `info`, `warn`, `error` |

## Architecture

```
src/
├── index.ts              # Entry point, module registration
├── config/               # Zod env validation
├── db/store.ts           # JSON persistence (Postgres-ready)
├── lib/
│   ├── ui.ts             # Design system (Embeds, Farben, Emojis)
│   ├── automod.ts        # AutoMod-Regeln
│   ├── logging.ts        # Unified audit log
│   └── levels.ts         # XP/Level Formeln
└── modules/
    ├── core/             # /setup, /cleanqueue
    ├── moderation/       # AutoMod, Mod-Commands, Anti-Raid
    ├── verification/     # Multi-Step Verify
    ├── tickets/          # Ticket Tool Style
    ├── logging/          # Message/Member Events
    ├── voice/            # Temp Voice + Control Panel
    ├── community/        # Levels, Poll, Giveaway
    └── games/            # Trivia, Coinflip
```

## Setup auf dem Server

1. Bot einladen mit Admin-Rechten (für `/setup`)
2. `/setup server` ausführen — legt Rollen, Channels, Panels an
3. `/cleanqueue help` für alle Befehle

**Bestehende Server:** `/setup server` erneut ausführen, wenn neue Rollen (Quarantine, Level 5/10/25) oder Channels fehlen. Bestehende Config wird gemerged.

## Proof of Life

Nach dem Start: `/cleanqueue status` auf dem Discord-Server.

## Build

```bash
npm run build -w @cleanqueue/shared
npm run build -w @cleanqueue/bot
node packages/bot/dist/index.js
```

## Inspiration (Research 2026)

- **MEE6** — Leveling, Welcome, Daily
- **Carl-bot** — Embeds, Logging, Reaction Roles
- **Dyno** — Umfassendes AutoMod, Mod-Logs
- **Wick** — Anti-Raid, Quarantine, Captcha-Verify
- **Ticket Tool** — Modal-Intake, Transcripts, Ratings
- **VoiceMaster** — Temp-Voice Control Panel
- **Arcane** — Rank Cards, Level-Rewards

## Roadmap (Phase Next)

- AI-Moderation (BYOK)
- Web-Dashboard für Config
- Postgres-Migration statt JSON
- Voice-XP, Starboard, Reaction Roles
