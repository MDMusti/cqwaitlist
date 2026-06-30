/**
 * Starts the Express waitlist API and the TypeScript Discord bot in one process group.
 * Used by Render (`npm start`) and local production runs.
 */
require('dotenv').config();
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

const children = [];
const botDir = path.join(__dirname, '..', 'packages', 'bot');
const botEntry = path.join(botDir, 'dist', 'index.js');

function start(label, command, args, cwd) {
  const child = spawn(command, args, {
    cwd: cwd || process.cwd(),
    stdio: 'inherit',
    env: process.env,
  });

  child.on('exit', (code, signal) => {
    console.error(`[${label}] beendet (code=${code}, signal=${signal})`);
    children.forEach((c) => c.kill('SIGTERM'));
    process.exit(code ?? 1);
  });

  children.push(child);
  return child;
}

process.on('SIGTERM', () => children.forEach((c) => c.kill('SIGTERM')));
process.on('SIGINT', () => children.forEach((c) => c.kill('SIGINT')));

if (!fs.existsSync(botEntry)) {
  console.error(`[Bot] Build fehlt: ${botEntry}`);
  console.error('[Bot] Führe zuerst "npm run build" aus (Render: buildCommand muss Bot kompilieren).');
  process.exit(1);
}

if (!process.env.BOT_TOKEN) {
  console.error('[Bot] BOT_TOKEN fehlt — Bot startet nicht. Setze BOT_TOKEN in Render Environment.');
  process.exit(1);
}

if (!process.env.CLIENT_ID) {
  console.error('[Bot] CLIENT_ID fehlt — Bot startet nicht. Setze CLIENT_ID in Render Environment.');
  process.exit(1);
}

if (!process.env.GUILD_ID) {
  console.warn('[Bot] GUILD_ID nicht gesetzt — Slash Commands werden global registriert (Propagation bis 1h).');
}

console.log(`[Bot] Starte ${botEntry}`);
start('API', 'node', ['server.js']);
start('Bot', 'node', ['dist/index.js'], botDir);
