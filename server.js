require('dotenv').config();
const express = require('express');
const axios = require('axios');
const cors = require('cors');
const fs = require('fs');
const path = require('path');

function normalizeRedirectUri(uri) {
  if (!uri) return null;
  const trimmed = uri.replace(/\/$/, '');
  return trimmed.endsWith('/callback') ? trimmed : `${trimmed}/callback`;
}

const REDIRECT_URI = normalizeRedirectUri(process.env.REDIRECT_URI);
const PORT = process.env.PORT || 3000;
const FRONTEND_URL = (process.env.FRONTEND_URL || `http://localhost:${PORT}`).replace(/\/$/, '');
const CORS_ORIGINS = new Set([
  FRONTEND_URL,
  'http://localhost:3000',
  'https://cqwaitlist.com',
  'https://www.cqwaitlist.com',
  'https://cqwaitlist.netlify.app',
]);
const REQUIRED_ENV = ['CLIENT_ID', 'CLIENT_SECRET', 'BOT_TOKEN', 'GUILD_ID', 'NOTIFY_CHANNEL_ID'];

function redirectFrontend(res, query) {
  const qs = query.startsWith('?') ? query : `?${query}`;
  res.redirect(`${FRONTEND_URL}/${qs}`);
}

function validateEnv() {
  const missing = REQUIRED_ENV.filter((key) => !process.env[key]);
  if (missing.length) {
    console.error(`[Config] Fehlende Umgebungsvariablen: ${missing.join(', ')}`);
    process.exit(1);
  }
  if (!REDIRECT_URI) {
    console.error('[Config] REDIRECT_URI fehlt (z. B. http://localhost:3000/callback)');
    process.exit(1);
  }
  if (!process.env.REDIRECT_URI.endsWith('/callback')) {
    console.warn(
      `[Config] REDIRECT_URI wurde automatisch korrigiert: ${process.env.REDIRECT_URI} -> ${REDIRECT_URI}`
    );
  }
}

validateEnv();

const app = express();
app.use(cors({
  origin(origin, callback) {
    if (!origin) return callback(null, true);
    callback(null, CORS_ORIGINS.has(origin));
  }
}));
app.use(express.json());

// ── WAITLIST STORAGE (JSON file, no database needed) ──
const WAITLIST_FILE = path.join(__dirname, 'waitlist.json');

function loadWaitlist() {
  if (!fs.existsSync(WAITLIST_FILE)) {
    fs.writeFileSync(WAITLIST_FILE, JSON.stringify([]));
  }
  return JSON.parse(fs.readFileSync(WAITLIST_FILE));
}

function saveWaitlist(list) {
  fs.writeFileSync(WAITLIST_FILE, JSON.stringify(list, null, 2));
}

// ── DISCORD API HELPER ──
const DISCORD_API = 'https://discord.com/api/v10';

async function discordRequest(method, endpoint, data = null, token = null) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bot ${token}`;
  const res = await axios({
    method,
    url: `${DISCORD_API}${endpoint}`,
    headers,
    data
  });
  return res.data;
}

// ── SEND NOTIFICATION TO YOUR SERVER CHANNEL ──
async function notifyChannel(user, position) {
  const embed = {
    embeds: [{
      color: 0x7c5cfc,
      author: {
        name: user.username,
        icon_url: user.avatar
          ? `https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.png`
          : `https://cdn.discordapp.com/embed/avatars/0.png`
      },
      title: '🛡️ Neuer Waitlist-Eintrag',
      fields: [
        { name: 'Benutzer', value: `<@${user.id}> \`${user.username}\``, inline: true },
        { name: 'Platz', value: `\`#${position}\``, inline: true },
        { name: 'Freie Plätze', value: `\`${3000 - position} von 3.000\``, inline: true },
      ],
      footer: { text: 'CleanQueue Waitlist' },
      timestamp: new Date().toISOString()
    }]
  };

  await discordRequest(
    'POST',
    `/channels/${process.env.NOTIFY_CHANNEL_ID}/messages`,
    embed,
    process.env.BOT_TOKEN
  );
}

// ── SEND DM TO THE USER ──
async function sendUserDM(userId, position, username) {
  try {
    // Create DM channel first
    const dmChannel = await discordRequest(
      'POST',
      '/users/@me/channels',
      { recipient_id: userId },
      process.env.BOT_TOKEN
    );

    const embed = {
      embeds: [{
        color: 0x7c5cfc,
        title: '✅ Du bist auf der Waitlist!',
        description: 'Willkommen bei **CleanQueue** — Gaming ohne Toxizität.\nWir benachrichtigen dich hier auf Discord, sobald wir öffnen.',
        fields: [
          { name: '🎯 Dein Platz', value: `**#${position}**`, inline: true },
          { name: '🔓 Freie Slots', value: `**${3000 - position} von 3.000**`, inline: true },
          {
            name: '🛡️ Was dich erwartet',
            value: '→ Zero-Toxicity Moderation\n→ Alle Games: Valorant, CS2, Marvel Rivals\n→ Team finden in unter 2 Minuten'
          }
        ],
        footer: {
          text: 'CleanQueue · cqwaitlist.com',
          icon_url: 'https://cdn.discordapp.com/embed/avatars/0.png'
        },
        timestamp: new Date().toISOString()
      }]
    };

    await discordRequest('POST', `/channels/${dmChannel.id}/messages`, embed, process.env.BOT_TOKEN);
  } catch (err) {
    // DMs might be closed — not critical
    console.log(`[DM] Konnte keine DM an ${username} senden (DMs möglicherweise deaktiviert)`);
  }
}

// ── ADD USER TO GUILD ──
async function addToGuild(userId, accessToken) {
  try {
    await axios.put(
      `${DISCORD_API}/guilds/${process.env.GUILD_ID}/members/${userId}`,
      { access_token: accessToken },
      {
        headers: {
          Authorization: `Bot ${process.env.BOT_TOKEN}`,
          'Content-Type': 'application/json'
        }
      }
    );
    console.log(`[Guild] User ${userId} zum Server hinzugefügt`);
  } catch (err) {
    console.log(`[Guild] User bereits auf Server oder Fehler: ${err.response?.data?.message}`);
  }
}

// ════════════════════════════════════════
// ROUTES
// ════════════════════════════════════════

// ── GET WAITLIST STATS (for the website counter) ──
app.get('/api/stats', (req, res) => {
  const list = loadWaitlist();
  res.set('Cache-Control', 'no-store, no-cache, must-revalidate');
  res.json({
    total: 3000,
    taken: list.length,
    free: 3000 - list.length
  });
});

// ── OAUTH2 REDIRECT INITIATOR ──
app.get('/auth/discord', (req, res) => {
  const params = new URLSearchParams({
    client_id: process.env.CLIENT_ID,
    redirect_uri: REDIRECT_URI,
    response_type: 'code',
    scope: 'identify guilds.join'
  });
  res.redirect(`https://discord.com/oauth2/authorize?${params}`);
});

// ── OAUTH2 CALLBACK ──
app.get('/callback', async (req, res) => {
  const { code } = req.query;

  if (!code) {
    return redirectFrontend(res, 'error=no_code');
  }

  try {
    // 1. Exchange code for access token
    const tokenRes = await axios.post(
      'https://discord.com/api/oauth2/token',
      new URLSearchParams({
        client_id: process.env.CLIENT_ID,
        client_secret: process.env.CLIENT_SECRET,
        grant_type: 'authorization_code',
        code,
        redirect_uri: REDIRECT_URI
      }),
      { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }
    );

    const { access_token } = tokenRes.data;

    // 2. Get user info
    const userRes = await axios.get('https://discord.com/api/users/@me', {
      headers: { Authorization: `Bearer ${access_token}` }
    });

    const user = userRes.data;

    // 3. Check if already on waitlist
    const list = loadWaitlist();
    const alreadyIn = list.find(u => u.id === user.id);

    if (alreadyIn) {
      return redirectFrontend(res, `already=true&pos=${alreadyIn.position}&username=${encodeURIComponent(user.username)}`);
    }

    // 4. Check if slots available
    if (list.length >= 3000) {
      return redirectFrontend(res, 'error=full');
    }

    // 5. Add to waitlist
    const position = list.length + 1;
    const entry = {
      id: user.id,
      username: user.username,
      avatar: user.avatar,
      position,
      joinedAt: new Date().toISOString(),
      access_token
    };

    list.push(entry);
    saveWaitlist(list);

    console.log(`[Waitlist] #${position} — ${user.username} (${user.id})`);

    // 6. Add to Discord server
    await addToGuild(user.id, access_token);

    // 7. Send notification to your channel
    await notifyChannel(user, position);

    // 8. Send DM to user
    await sendUserDM(user.id, position, user.username);

    // 9. Redirect back to website with success
    redirectFrontend(res, `success=true&pos=${position}&username=${encodeURIComponent(user.username)}`);

  } catch (err) {
    console.error('[OAuth Error]', err.response?.data || err.message);
    redirectFrontend(res, 'error=oauth_failed');
  }
});

// ── SERVE THE WEBSITE ──
app.use(express.static(path.join(__dirname, 'public')));
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// ── START ──
app.listen(PORT, () => {
  console.log(`
╔══════════════════════════════════════╗
║   CleanQueue Backend läuft!          ║
║   Frontend: ${FRONTEND_URL}
║   OAuth:    ${REDIRECT_URI}
╚══════════════════════════════════════╝
  `);
});

const { startBot } = require('./bot');
startBot().catch((err) => console.error('[Bot] Start fehlgeschlagen:', err.message));
