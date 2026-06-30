require('dotenv').config();
const { REST, Routes } = require('discord.js');
const fs = require('fs');
const path = require('path');

function loadCommandPayloads() {
  const commandsPath = path.join(__dirname, 'commands');
  return fs
    .readdirSync(commandsPath)
    .filter((f) => f.endsWith('.js'))
    .map((f) => require(path.join(commandsPath, f)).data.toJSON());
}

async function registerCommands() {
  const required = ['BOT_TOKEN', 'CLIENT_ID'];
  const missing = required.filter((k) => !process.env[k]);
  if (missing.length) {
    throw new Error(`Fehlende Variablen: ${missing.join(', ')}`);
  }

  const body = loadCommandPayloads();
  const rest = new REST().setToken(process.env.BOT_TOKEN);
  const names = body.map((c) => `/${c.name}`).join(', ');

  if (process.env.GUILD_ID) {
    await rest.put(
      Routes.applicationGuildCommands(process.env.CLIENT_ID, process.env.GUILD_ID),
      { body }
    );
    console.log(`[Commands] Guild registriert: ${names} (Guild ${process.env.GUILD_ID})`);
    return { scope: 'guild', count: body.length };
  }

  await rest.put(Routes.applicationCommands(process.env.CLIENT_ID), { body });
  console.log(`[Commands] Global registriert: ${names} (Sichtbarkeit kann bis zu 1h dauern)`);
  return { scope: 'global', count: body.length };
}

module.exports = { registerCommands, loadCommandPayloads };
