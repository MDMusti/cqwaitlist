const { ChannelType, PermissionFlagsBits } = require('discord.js');

const TICKET_BUTTON = 'ticket_create';

async function createTicket(interaction) {
  const guild = interaction.guild;
  const member = interaction.member;
  const supportCat = guild.channels.cache.find(
    (c) => c.type === ChannelType.GuildCategory && c.name === 'SUPPORT'
  );

  const existing = guild.channels.cache.find(
    (c) => c.name === `ticket-${member.user.username.toLowerCase().replace(/[^a-z0-9]/g, '')}`
  );
  if (existing) {
    return interaction.reply({ content: `Du hast bereits ein Ticket: ${existing}`, ephemeral: true });
  }

  const staffRoles = ['Admin', 'Moderator', 'Support'];
  const overwrites = [
    { id: guild.roles.everyone.id, deny: [PermissionFlagsBits.ViewChannel] },
    {
      id: member.id,
      allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory],
    },
  ];
  for (const name of staffRoles) {
    const role = guild.roles.cache.find((r) => r.name === name);
    if (role) {
      overwrites.push({
        id: role.id,
        allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory],
      });
    }
  }

  const channel = await guild.channels.create({
    name: `ticket-${member.user.username.toLowerCase().replace(/[^a-z0-9-]/g, '').slice(0, 20)}`,
    type: ChannelType.GuildText,
    parent: supportCat?.id,
    permissionOverwrites: overwrites,
    topic: `Ticket von ${member.user.tag}`,
  });

  await channel.send({
    content: `${member} Willkommen in deinem Ticket! Das Team meldet sich bald.\n\nBeschreibe dein Anliegen so genau wie möglich.`,
  });

  await interaction.reply({ content: `✅ Ticket erstellt: ${channel}`, ephemeral: true });
}

module.exports = { TICKET_BUTTON, createTicket };
