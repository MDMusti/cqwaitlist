/**
 * Starts the Express waitlist API and the TypeScript Discord bot in one process group.
 * Used by Render (`npm start`) and local production runs.
 */
require('dotenv').config();
const { spawn } = require('child_process');
const path = require('path');

const children = [];

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

start('API', 'node', ['server.js']);
start('Bot', 'node', ['dist/index.js'], path.join(__dirname, '..', 'packages', 'bot'));
