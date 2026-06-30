const { addXp } = require('../systems/levels');

module.exports = {
  name: 'messageCreate',
  execute(message) {
    if (message.author.bot || !message.guild) return;
    addXp(message.author.id);
  },
};
