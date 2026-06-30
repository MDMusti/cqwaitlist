const { registerCommands } = require('./register-commands');

registerCommands()
  .then(({ scope, count }) => {
    console.log(`[Deploy] ${count} Command(s) als ${scope} registriert`);
  })
  .catch((err) => {
    console.error('[Deploy] Fehler:', err.message || err);
    process.exit(1);
  });
