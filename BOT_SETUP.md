# CleanQueue Discord Bot — Setup

Phase-1-MVP: Server-Setup, Tickets, Altersverifizierung und Level-System neben der bestehenden Waitlist.

## Voraussetzungen

- Node.js 18+
- Discord-Application mit Bot-Token ([Developer Portal](https://discord.com/developers/applications))
- Bot eingeladen mit Scope **`bot`** und **`applications.commands`** (ohne `applications.commands` erscheinen Slash-Commands nicht)
- Berechtigungen: `Manage Roles`, `Manage Channels`, `Send Messages`, `Read Message History`, `Add Reactions` (für Setup: Administrator empfohlen)

### Bot einladen (Invite-URL)

Ersetze `DEINE_CLIENT_ID` durch die Application ID aus dem Developer Portal:

```
https://discord.com/api/oauth2/authorize?client_id=DEINE_CLIENT_ID&permissions=8&scope=bot%20applications.commands
```

`permissions=8` = Administrator. Für weniger Rechte den Permission-Wert im [Discord Permission Calculator](https://discordapi.com/permissions.html) anpassen — **`scope=bot%20applications.commands` muss immer enthalten sein.**

### Bot-Intents aktivieren

Im Developer Portal unter **Bot → Privileged Gateway Intents**:

- **Server Members Intent** — aktivieren
- **Message Content Intent** — aktivieren

## Umgebungsvariablen

Kopiere `.env.example` nach `.env` und fülle aus:

| Variable | Beschreibung |
|----------|--------------|
| `CLIENT_ID` | Application ID |
| `CLIENT_SECRET` | OAuth Client Secret |
| `BOT_TOKEN` | Bot Token |
| `GUILD_ID` | Discord-Server-ID |
| `NOTIFY_CHANNEL_ID` | Channel für Waitlist-Benachrichtigungen |
| `REDIRECT_URI` | OAuth Callback (z. B. `http://localhost:3000/callback`) |
| `FRONTEND_URL` | Website-URL für Redirects |

## Installation

```bash
npm install
```

## Commands deployen

Slash-Commands werden **automatisch beim Bot-Start** registriert (Guild, wenn `GUILD_ID` gesetzt; sonst global).

Manuell deployen (optional, z. B. lokal ohne Server-Start):

```bash
npm run deploy-commands
```

## Server starten

```bash
npm start
```

Startet Express (Waitlist + OAuth) **und** den Discord-Bot in einem Prozess.

## Server einrichten

1. Bot auf den Discord-Server einladen (Administrator empfohlen für Setup)
2. Auf dem Server `/setup-server` ausführen (nur Admins)

Der Command erstellt:

**Rollen:** Admin, Moderator, Support, Verified 18+, Member, Muted, Gamer, Artist, Music, Events

**Kategorien:** INFO, COMMUNITY, VOICE, SUPPORT, STAFF (versteckt)

**Channels:**

| Kategorie | Channels |
|-----------|----------|
| INFO | willkommen, regeln, ankündigungen |
| COMMUNITY | chat, media, verify |
| SUPPORT | tickets, bewerbung |
| VOICE | voice-1, voice-2, voice-3 |
| STAFF | staff-only |

**Panels:**

- **#tickets** — Button „Ticket erstellen“ (privater Support-Channel)
- **#verify** — Button „Ich bin 18+“ (vergibt Rolle Verified 18+)
- **#chat** — Community-Rollen-Auswahl (Gamer, Artist, Music, Events)

## Module

```
bot/
├── index.js              # Client, Intents, startBot()
├── register-commands.js  # Guild/Global-Command-Registrierung
├── deploy-commands.js    # CLI-Wrapper für register-commands
├── commands/
│   └── setup-server.js   # /setup-server Slash-Command
├── events/
│   ├── ready.js
│   ├── interactionCreate.js
│   └── messageCreate.js  # XP-System
└── systems/
    ├── tickets.js
    ├── verification.js
    └── levels.js         # JSON-Speicher in bot/data/levels.json
```

## Level-System

- XP pro Nachricht (15–25, zufällig)
- 60 Sekunden Cooldown pro User
- Level-Up bei 100 × aktuelles Level XP
- Daten in `bot/data/levels.json` (gitignored)

## Troubleshooting

| Problem | Lösung |
|---------|--------|
| Bot startet nicht | `BOT_TOKEN` prüfen, Intents aktivieren |
| `/setup-server` unsichtbar | Bot mit `applications.commands`-Scope neu einladen; Render redeployen (Commands registrieren beim Start); Discord-Cache: Cmd+R oder Bot neu starten; `GUILD_ID` und `CLIENT_ID` in Render prüfen |
| Buttons reagieren nicht | Bot braucht `Manage Channels` + `Manage Roles` |
| RoleSelect leer | `/setup-server` erneut ausführen (Rollen müssen existieren) |

## Waitlist

Die OAuth-Waitlist in `server.js` bleibt unverändert und läuft parallel zum Bot.
