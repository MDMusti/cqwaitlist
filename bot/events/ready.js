const { registerCommands } = require('../register-commands');

module.exports = {
  name: 'ready',
  once: true,
  async execute(client) {
    console.log(`[Bot] Eingeloggt als ${client.user.tag}`);
    try {
      await registerCommands();
    } catch (err) {
      console.error('[Bot] Command-Registrierung fehlgeschlagen:', err.message || err);
    }
  },
};
