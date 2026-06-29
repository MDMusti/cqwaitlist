# CleanQueue — Deployment (Netlify + Backend)

Die App ist in zwei Teile aufgeteilt:

| Teil | Hosting | Inhalt |
|------|---------|--------|
| **Frontend** | [Netlify](https://cqwaitlist.com) | Statische Seite aus `public/` |
| **Backend** | Render / Railway / VPS | Express (`server.js`) — OAuth, API, Waitlist |

---

## Architektur

```
Browser (Netlify)                    Backend (Render/Railway)
─────────────────                    ────────────────────────
cqwaitlist.com                       https://xxx.onrender.com
       │                                      │
       ├─ fetch /api/stats ──────────────────► GET /api/stats
       ├─ Klick „Mit Discord anmelden“ ─────► GET /auth/discord
       │                                      │
       │                               Discord OAuth
       │                                      │
       │                               GET /callback (Backend-URL!)
       │                                      │
       ◄── Redirect mit ?success=true ────────┘
```

**REDIRECT_URI = Backend-URL** (`https://dein-backend.onrender.com/callback`), nicht die Netlify-URL.  
Discord leitet nach dem Login direkt ans Backend; das Backend verarbeitet den Code und leitet dann zur Netlify-Frontend-URL weiter.

---

## Lokal entwickeln (alles auf einem Server)

Website und Bot laufen weiterhin zusammen auf Express — kein Netlify nötig.

```bash
cd ~/Downloads/cleanqueue-bot
cp .env.example .env   # Discord-Werte eintragen
npm install
npm start
```

Browser: **http://localhost:3000**

`.env` lokal:

```env
REDIRECT_URI=http://localhost:3000/callback
FRONTEND_URL=http://localhost:3000
```

`public/config.js` hat `API_URL: ''` → relative Pfade, alles auf demselben Port.

---

## 1. Backend deployen (Render empfohlen)

### Render

1. Repo auf GitHub pushen
2. [render.com](https://render.com) → **New Web Service** → Repo verbinden
3. **Build Command:** `npm install`
4. **Start Command:** `npm start`
5. Umgebungsvariablen setzen (siehe Tabelle unten)
6. Nach Deploy: Backend-URL notieren, z. B. `https://cleanqueue-bot.onrender.com`

`render.yaml` im Repo kann als Blueprint dienen.

### Railway / Heroku / Docker

- **Railway:** Repo verbinden, Start `npm start`, gleiche Env-Vars
- **Heroku:** `Procfile` ist enthalten → `git push heroku main`
- **Docker:** `docker build -t cleanqueue-bot .` → `docker run -p 3000:3000 -e ... cleanqueue-bot`

---

## 2. Frontend auf Netlify

### Repo-Einstellungen

| Einstellung | Wert |
|-------------|------|
| Base directory | *(leer oder Projektroot)* |
| Build command | `node scripts/generate-config.js` |
| Publish directory | `public` |

Alternativ: `netlify.toml` im Repo — wird automatisch erkannt.

### Netlify Environment Variables

| Variable | Beispiel | Beschreibung |
|----------|----------|--------------|
| `PUBLIC_API_URL` | `https://cleanqueue-bot.onrender.com` | Backend-URL für API + Discord-Login (ohne trailing slash) |

Beim Build schreibt `scripts/generate-config.js` daraus `public/config.js`.

---

## 3. Discord Developer Portal

Unter [Discord Developer Portal](https://discord.com/developers/applications) → deine App → **OAuth2** → **Redirects**:

| Umgebung | Redirect URI |
|----------|--------------|
| Lokal | `http://localhost:3000/callback` |
| Produktion | `https://dein-backend.onrender.com/callback` |

**Wichtig:** Die Produktions-Redirect-URI ist die **Backend-URL**, nicht `cqwaitlist.com`.

Scopes: `identify`, `guilds.join` (werden vom Backend gesetzt).

---

## Umgebungsvariablen — Übersicht

### Backend (Render / Railway / `.env`)

| Variable | Lokal | Produktion |
|----------|-------|------------|
| `CLIENT_ID` | Discord App ID | gleich |
| `CLIENT_SECRET` | Discord Secret | gleich |
| `BOT_TOKEN` | Bot Token | gleich |
| `GUILD_ID` | Server-ID | gleich |
| `NOTIFY_CHANNEL_ID` | Channel-ID | gleich |
| `REDIRECT_URI` | `http://localhost:3000/callback` | `https://BACKEND-URL/callback` |
| `FRONTEND_URL` | `http://localhost:3000` | `https://cqwaitlist.com` |
| `PORT` | `3000` | vom Host gesetzt |

### Netlify (nur Frontend-Build)

| Variable | Wert |
|----------|------|
| `PUBLIC_API_URL` | `https://BACKEND-URL` (ohne `/callback`) |

---

## Checkliste nach Deploy

- [ ] Backend erreichbar: `curl https://BACKEND-URL/api/stats`
- [ ] Netlify-Seite lädt Slot-Counter (kein CORS-Fehler in Browser-Konsole)
- [ ] Discord-Login-Button zeigt auf `BACKEND-URL/auth/discord`
- [ ] Nach OAuth: Redirect zurück zu `cqwaitlist.com/?success=true&...`
- [ ] Discord Portal: Backend-`/callback` eingetragen

---

## Alternative: Netlify-Proxy (optional)

Statt `PUBLIC_API_URL` kann Netlify API-Routen ans Backend proxen — dann bleiben relative URLs (`/api/stats`). Nachteile: OAuth-Callback über Proxy ist fehleranfälliger; **empfohlen ist die direkte Backend-URL** (siehe oben).

Falls gewünscht, in `netlify.toml` ergänzen:

```toml
[[redirects]]
  from = "/api/*"
  to = "https://BACKEND-URL/api/:splat"
  status = 200
  force = true

[[redirects]]
  from = "/auth/discord"
  to = "https://BACKEND-URL/auth/discord"
  status = 302

[[redirects]]
  from = "/callback"
  to = "https://BACKEND-URL/callback"
  status = 200
  force = true
```

Dann `REDIRECT_URI=https://cqwaitlist.com/callback` — nur wenn du diesen Weg bewusst wählst.

---

## Troubleshooting

| Problem | Lösung |
|---------|--------|
| Slot-Counter bleibt bei 0 / CORS-Fehler | `PUBLIC_API_URL` auf Netlify prüfen; `FRONTEND_URL=https://cqwaitlist.com` auf Backend |
| OAuth „Invalid redirect_uri“ | `REDIRECT_URI` auf Backend muss **exakt** im Discord Portal stehen |
| Nach Login landet man auf Backend statt Netlify | `FRONTEND_URL` auf Backend setzen |
| Lokal funktioniert, Prod nicht | Backend-URL in Netlify `PUBLIC_API_URL`; Backend neu deployen nach Env-Änderung |
