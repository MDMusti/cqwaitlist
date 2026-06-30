# CleanQueue Bot

Modularer TypeScript Discord Bot — Premium Upgrade Pass mit Enterprise-UI.

## Schnellstart

Vom Repository-Root:

```bash
npm install
npm run build
npm run start:bot
```

Ausführliche deutsche Anleitung: [BOT_SETUP.md](../../BOT_SETUP.md)

## Architektur

```
src/
├── lib/ui.ts           # Design System — Embeds, Farben, Emojis
├── modules/
│   ├── core/           # /cleanqueue, /setup
│   ├── verification/   # Multi-Step 18+ Gate
│   ├── tickets/        # Modal-Flow, Claim, Transkripte
│   ├── moderation/     # /mod, AutoMod, Anti-Raid
│   ├── community/      # XP, Level-Up, /rank
│   ├── voice/          # Temp Voice Control Panel
│   └── games/          # Blackjack, Trivia, Coinflip
└── db/store.ts         # JSON Persistenz
```

## Wichtige Befehle

- `/cleanqueue help` — Command Hub
- `/setup server` — Server-Struktur (Admin)
- `/mod warn|mute|kick|ban|timeout|history` — Moderation
- `/rank` — Profil & XP
- `/blackjack` — Mini-Game

## Build

```bash
npm run build -w @cleanqueue/bot
```
