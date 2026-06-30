module.exports = {
  name: 'ready',
  once: true,
  execute(client) {
    console.log(`[Bot] Eingeloggt als ${client.user.tag}`);
  },
};
