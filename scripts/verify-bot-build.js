const fs = require('fs');
const path = require('path');

const botEntry = path.join(__dirname, '..', 'packages', 'bot', 'dist', 'index.js');

if (!fs.existsSync(botEntry)) {
  console.error(`Bot build verification failed: missing ${botEntry}`);
  process.exit(1);
}

console.log(`Bot build OK: ${botEntry}`);
