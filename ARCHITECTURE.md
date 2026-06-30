# CleanQueue Architecture

**Deutsch unten · English below**

---

## English

CleanQueue is an enterprise-grade, modular Discord platform. Phase 1 delivers the monorepo skeleton, core bot framework, infrastructure stubs, and a proof-of-life command. Feature modules ship incrementally.

### Repository Layout

```
cleanqueue/
├── packages/
│   ├── bot/          # Discord bot (TypeScript, discord.js)
│   ├── api/          # REST API placeholder (waitlist stays in server.js for now)
│   └── shared/       # Shared types and utilities
├── prisma/           # PostgreSQL schema (Prisma)
├── public/           # Waitlist frontend (static)
├── server.js         # Express waitlist + OAuth (Netlify/Render compatible)
├── docker-compose.yml
└── ARCHITECTURE.md
```

### Core Framework (Phase 1)

| Component | Responsibility |
|-----------|----------------|
| `CleanQueueClient` | Extended Discord.js client with command/event collections |
| `ModuleRegistry` | Registers modules, bootstraps commands and events |
| `CommandLoader` / `EventLoader` | Loads module exports into the client |
| `config` | Zod-validated environment |
| `logger` | Pino structured logging |

### Module Map

| Module | Phase | Status |
|--------|-------|--------|
| **core** | 1 | ✅ Active — `/cleanqueue status`, slash registration |
| **verification** | 2 | ⏳ Placeholder |
| **tickets** | 2 | ⏳ Placeholder |
| **logging** | 2 | ⏳ Placeholder |
| **moderation** | 2 | ⏳ Placeholder |
| **community** | 3 | ⏳ Placeholder |
| **voice** | 3 | ⏳ Placeholder |

### Phased Roadmap

**Phase 1 — Foundation (current)**
- Monorepo with npm workspaces
- Core bot framework + module registry
- Prisma schema stubs (GuildConfig, User, Member, Case, AuditLog)
- Docker Compose (Postgres + Redis)
- `/cleanqueue status` proof of life
- Waitlist Express server unchanged (minus old bot)

**Phase 2 — Essential Modules**
- Verification (18+ gate, onboarding)
- Tickets (panel, private channels, close flow)
- Logging (audit + mod log to DB)
- Moderation (warn/mute/kick/ban, cases in Prisma)
- Prisma migrations + Redis caching layer
- Migrate waitlist to `packages/api` (optional)

**Phase 3 — Community & Voice**
- Community (levels, role panels, engagement)
- Voice (temp channels, activity)
- Dashboard API endpoints

**Phase 4+ — Enterprise**
- AI moderation assist
- Games / LFG integrations
- Multi-guild SaaS config
- Observability (metrics, tracing)

### Tech Stack

- **Bot:** TypeScript, discord.js 14, Pino
- **API:** Express (Phase 1 legacy), future modular REST in `packages/api`
- **Database:** PostgreSQL + Prisma
- **Cache:** Redis
- **Deploy:** Render (web service), Netlify (frontend static)

---

## Deutsch

CleanQueue ist eine enterprise-taugliche, modulare Discord-Plattform. Phase 1 liefert Monorepo-Grundgerüst, Core-Bot-Framework, Infrastruktur-Stubs und einen Proof-of-Life-Command. Feature-Module folgen schrittweise.

### Repository-Struktur

Siehe Layout oben — `packages/bot` für den Bot, `packages/shared` für gemeinsame Typen, `server.js` bleibt für Waitlist/OAuth.

### Core Framework (Phase 1)

| Komponente | Aufgabe |
|------------|---------|
| `CleanQueueClient` | Erweiterter Discord.js-Client |
| `ModuleRegistry` | Modul-Registrierung und Bootstrap |
| `CommandLoader` / `EventLoader` | Commands und Events laden |
| `config` | Zod-Umgebungsvalidierung |
| `logger` | Strukturiertes Pino-Logging |

### Modul-Karte

| Modul | Phase | Status |
|-------|-------|--------|
| **core** | 1 | ✅ Aktiv — `/cleanqueue status` |
| **verification** | 2 | ⏳ Platzhalter |
| **tickets** | 2 | ⏳ Platzhalter |
| **logging** | 2 | ⏳ Platzhalter |
| **moderation** | 2 | ⏳ Platzhalter |
| **community** | 3 | ⏳ Platzhalter |
| **voice** | 3 | ⏳ Platzhalter |

### Phasen-Roadmap

**Phase 1 — Fundament (aktuell)**
- Monorepo, Core-Framework, Prisma-Stubs, Docker, Status-Command
- Altes `bot/`-Verzeichnis entfernt

**Phase 2 — Kernmodule**
- Verifizierung, Tickets, Logging, Moderation
- DB-Migrationen, Redis

**Phase 3 — Community & Voice**
- Level-System, Voice-Channels, Dashboard-API

**Phase 4+ — Enterprise**
- AI-Moderation, Games, Multi-Guild, Observability

### Manueller Discord-Server-Cleanup

Das alte `/setup-server` hat Rollen und Channels angelegt. Diese werden **nicht** automatisch entfernt. Vor Phase 2 manuell aufräumen:

- Alte Setup-Rollen prüfen (Admin, Moderator, Verified 18+, …)
- Alte Kategorien/Channels (INFO, COMMUNITY, SUPPORT, …) archivieren oder löschen
- Ticket-/Verify-Panels in `#tickets` / `#verify` entfernen

Neue Module bringen ihr eigenes Setup in Phase 2.
