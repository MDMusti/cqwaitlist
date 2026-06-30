const { TICKET_BUTTON, createTicket } = require('../systems/tickets');
const { VERIFY_BUTTON, handleVerify } = require('../systems/verification');

const COMMUNITY_SELECT = 'community_roles';

module.exports = {
  name: 'interactionCreate',
  async execute(interaction, client) {
    if (interaction.isChatInputCommand()) {
      const cmd = client.commands.get(interaction.commandName);
      if (!cmd) return;
      return cmd.execute(interaction).catch((err) => {
        console.error('[Bot] Command-Fehler:', err);
        const msg = { content: '❌ Ein Fehler ist aufgetreten.', ephemeral: true };
        if (interaction.replied || interaction.deferred) interaction.followUp(msg);
        else interaction.reply(msg);
      });
    }

    if (interaction.isButton()) {
      if (interaction.customId === TICKET_BUTTON) return createTicket(interaction);
      if (interaction.customId === VERIFY_BUTTON) return handleVerify(interaction);
    }

    if (interaction.isRoleSelectMenu() && interaction.customId === COMMUNITY_SELECT) {
      const allowed = ['Gamer', 'Artist', 'Music', 'Events'];
      const communityRoles = interaction.guild.roles.cache.filter((r) => allowed.includes(r.name));
      const selected = interaction.values;

      const toRemove = communityRoles.filter((r) => interaction.member.roles.cache.has(r.id) && !selected.includes(r.id));
      await interaction.member.roles.remove([...toRemove.keys()]);
      await interaction.member.roles.add(selected);

      return interaction.reply({
        content: `✅ Community-Rollen aktualisiert: ${selected.map((id) => `<@&${id}>`).join(', ') || 'Keine'}`,
        ephemeral: true,
      });
    }
  },
};
