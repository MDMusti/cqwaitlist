# CleanQueue Bot — Setup & Premium Features

Deutschsprachige Anleitung für den CleanQueue Discord Bot (Premium Upgrade Pass).

## Voraussetzungen

- Node.js 20+
- Discord Application mit Bot Token ([Developer Portal](https://discord.com/developers/applications))
- Bot-Scopes: `bot` + `applications.commands`
- Bot benötigt **Administrator** für `/setup server`

## Schnellstart

```bash
cp .env.example .env
# BOT_TOKEN, CLIENT_ID, GUILD_ID eintragen

npm install
npm run build
npm run start:bot
```

## Ersteinrichtung auf dem Discord-Server

1. Bot einladen und starten
2. **`/setup server`** als Admin ausführen
3. Der Bot legt Rollen, Kategorien, Channels und Panels an
4. Mitglieder verifizieren sich in `#verify`

> **Wichtig:** Nach dem Premium-Upgrade **`/setup server` erneut ausführen**, damit neue Channels (`bot-befehle`, `level-up`, `voice-control`, `automod-log`, …) angelegt und Panels aktualisiert werden.

## Command Hub — `/cleanqueue`

| Subcommand | Beschreibung |
|------------|--------------|
| `help` | Alle Befehle nach Modul gruppiert |
| `modules` | Modul-Status mit Phase-Badges |
| `profile [@user]` | XP, Level, Strikes, Streak, Fortschrittsbalken |
| `status` | System-Info, Uptime, Infrastruktur |

## Module im Überblick

### Verifizierung (Multi-Step)
- Button → Regeln bestätigen → Captcha → Rollen + Channel-Freischaltung
- Account-Mindestalter (Standard: 7 Tage)
- Screening: neue Mitglieder sehen nur `#verify` und `#regeln`

### Tickets
- Abteilung wählen → Modal (Betreff + Beschreibung)
- Willkommens-Embed mit Account-Alter & Join-Datum
- Staff-Ping bei neuem Ticket
- **Claim**-Button für Team-Mitglieder
- Transkript beim Schließen

### Moderation — `/mod`
- `warn` · `mute` · `kick` · `ban` · `timeout` · `history` · `note`
- Strike-System (3 Strikes → Auto-Mute + DM)
- AutoMod: Invites, Massen-Mentions, Spam, Caps, wiederholter Text
- Anti-Raid bei Join-Wellen

### Community
- XP durch Nachrichten, `/daily`, `/rank`, `/levels`, `/leaderboard`
- Level-Up Ankündigungen in `#level-up`
- Rollen-Panel mit Beschreibungen (Gamer, Künstler, Developer, Streamer)

### Voice
- Temp-Voice über `➕ Create Voice`
- Control Panel in `#voice-control`: Sperren, Umbenennen, Limit, Kick, Bitrate

### Games
- `/blackjack` — Hit or Stand
- `/trivia`, `/coinflip`

## Design System

Alle Embeds nutzen `packages/bot/src/lib/ui.ts`:
- Einheitliche Farben, Emojis, Footer „CleanQueue · Enterprise Discord Platform"
- Builder: `primaryEmbed`, `successEmbed`, `warningEmbed`, `modCaseEmbed`, `welcomeEmbed`, `levelUpEmbed`, …

## Daten

- **JSON Store** unter `data/cleanqueue-store.json` (kein Postgres nötig)
- Ticket-Transkripte unter `data/transcripts/`

## Umgebungsvariablen

| Variable | Pflicht | Beschreibung |
|----------|---------|--------------|
| `BOT_TOKEN` | ja | Discord Bot Token |
| `CLIENT_ID` | ja | Application ID |
| `GUILD_ID` | empfohlen | Guild für Dev-Command-Registration |
| `DATABASE_URL` | nein | Optional — Postgres |
| `LOG_LEVEL` | nein | `debug`, `info`, `warn`, `error` |

## Nächste Schritte (nicht in diesem Pass)

- Web-Dashboard
- Echte AI-Integration
- Postgres-Migration (Store ist vorbereitet)
