require('dotenv').config();
const { REST, Routes } = require('discord.js');
const setupServer = require('./commands/setup-server');

const required = ['BOT_TOKEN', 'CLIENT_ID', 'GUILD_ID'];
const missing = required.filter((k) => !process.env[k]);
if (missing.length) {
  console.error(`[Deploy] Fehlende Variablen: ${missing.join(', ')}`);
  process.exit(1);
}

const rest = new REST().setToken(process.env.BOT_TOKEN);

rest
  .put(
    Routes.applicationGuildCommands(process.env.CLIENT_ID, process.env.GUILD_ID),
    { body: [setupServer.data.toJSON()] }
  )
  .then(() => console.log('[Deploy] Guild-Commands registriert (/setup-server)'))
  .catch((err) => {
    console.error('[Deploy] Fehler:', err);
    process.exit(1);
  });
