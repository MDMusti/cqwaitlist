const {
  SlashCommandBuilder,
  PermissionFlagsBits,
  ChannelType,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  StringSelectMenuBuilder,
  StringSelectMenuOptionBuilder,
  MessageFlags,
} = require('discord.js');
const { TICKET_BUTTON } = require('../systems/tickets');
const { VERIFY_BUTTON } = require('../systems/verification');

const COMMUNITY_SELECT = 'community_roles';

const ROLE_DEFS = [
  { name: 'Member', color: 0x95a5a6, hoist: false },
  { name: 'Muted', color: 0x7f8c8d, hoist: false },
  { name: 'Verified 18+', color: 0x2ecc71, hoist: true },
  { name: 'Gamer', color: 0x3498db, hoist: false },
  { name: 'Artist', color: 0xe74c3c, hoist: false },
  { name: 'Music', color: 0x9b59b6, hoist: false },
  { name: 'Events', color: 0xf39c12, hoist: false },
  { name: 'Support', color: 0x1abc9c, hoist: true },
  { name: 'Moderator', color: 0xe67e22, hoist: true },
  { name: 'Admin', color: 0xc0392b, hoist: true },
];

const STAFF_ROLES = ['Admin', 'Moderator', 'Support'];

async function getOrCreateRole(guild, def) {
  let role = guild.roles.cache.find((r) => r.name === def.name);
  if (!role) {
    role = await guild.roles.create({
      name: def.name,
      colors: { primaryColor: def.color },
      hoist: def.hoist,
      reason: 'CleanQueue Setup',
    });
  }
  return role;
}

async function createCategory(guild, name, hidden = false) {
  const existing = guild.channels.cache.find((c) => c.type === ChannelType.GuildCategory && c.name === name);
  if (existing) return existing;

  const overwrites = [];
  if (hidden) {
    overwrites.push({ id: guild.roles.everyone.id, deny: [PermissionFlagsBits.ViewChannel] });
    for (const roleName of STAFF_ROLES) {
      const role = guild.roles.cache.find((r) => r.name === roleName);
      if (role) {
        overwrites.push({
          id: role.id,
          allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory],
        });
      }
    }
  }

  return guild.channels.create({ name, type: ChannelType.GuildCategory, permissionOverwrites: overwrites, reason: 'CleanQueue Setup' });
}

async function createTextChannel(guild, name, parent, opts = {}) {
  const existing = guild.channels.cache.find((c) => c.name === name && c.parentId === parent?.id);
  if (existing) return existing;

  const { readOnly = false, staffOnly = false } = opts;
  const overwrites = [];

  if (staffOnly) {
    overwrites.push({ id: guild.roles.everyone.id, deny: [PermissionFlagsBits.ViewChannel] });
    for (const roleName of STAFF_ROLES) {
      const role = guild.roles.cache.find((r) => r.name === roleName);
      if (role) {
        overwrites.push({
          id: role.id,
          allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory],
        });
      }
    }
  } else if (readOnly) {
    overwrites.push({ id: guild.roles.everyone.id, deny: [PermissionFlagsBits.SendMessages] });
    for (const roleName of STAFF_ROLES) {
      const role = guild.roles.cache.find((r) => r.name === roleName);
      if (role) {
        overwrites.push({ id: role.id, allow: [PermissionFlagsBits.SendMessages] });
      }
    }
  }

  return guild.channels.create({
    name,
    type: ChannelType.GuildText,
    parent: parent?.id,
    permissionOverwrites: overwrites.length ? overwrites : undefined,
    reason: 'CleanQueue Setup',
  });
}

async function createVoiceChannel(guild, name, parent) {
  const existing = guild.channels.cache.find((c) => c.name === name && c.parentId === parent?.id);
  if (existing) return existing;
  return guild.channels.create({ name, type: ChannelType.GuildVoice, parent: parent?.id, reason: 'CleanQueue Setup' });
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('setup-server')
    .setDescription('Richtet Rollen, Kategorien, Channels und Panels ein')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  async execute(interaction) {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    const guild = interaction.guild;

    for (const def of ROLE_DEFS) await getOrCreateRole(guild, def);

    const catInfo = await createCategory(guild, 'INFO');
    const catCommunity = await createCategory(guild, 'COMMUNITY');
    const catVoice = await createCategory(guild, 'VOICE');
    const catSupport = await createCategory(guild, 'SUPPORT');
    const catStaff = await createCategory(guild, 'STAFF', true);

    const chWillkommen = await createTextChannel(guild, 'willkommen', catInfo, { readOnly: true });
    const chRegeln = await createTextChannel(guild, 'regeln', catInfo, { readOnly: true });
    const chAnkuendigungen = await createTextChannel(guild, 'ankündigungen', catInfo, { readOnly: true });
    const chChat = await createTextChannel(guild, 'chat', catCommunity);
    const chMedia = await createTextChannel(guild, 'media', catCommunity);
    const chVerify = await createTextChannel(guild, 'verify', catCommunity, { readOnly: true });
    const chTickets = await createTextChannel(guild, 'tickets', catSupport, { readOnly: true });
    const chBewerbung = await createTextChannel(guild, 'bewerbung', catSupport, { readOnly: true });
    await createVoiceChannel(guild, 'voice-1', catVoice);
    await createVoiceChannel(guild, 'voice-2', catVoice);
    await createVoiceChannel(guild, 'voice-3', catVoice);
    const chStaff = await createTextChannel(guild, 'staff-only', catStaff, { staffOnly: true });

    const communityRoles = ['Gamer', 'Artist', 'Music', 'Events']
      .map((n) => guild.roles.cache.find((r) => r.name === n))
      .filter(Boolean);

    await chWillkommen.send({
      embeds: [{
        color: 0x7c5cfc,
        title: '👋 Willkommen bei CleanQueue!',
        description: 'Gaming ohne Toxizität — schön, dass du da bist.\n\nLies die **Regeln**, verifiziere dich in **#verify** und wähle deine Community-Rollen in **#chat**.',
      }],
    });

    await chRegeln.send({
      embeds: [{
        color: 0x7c5cfc,
        title: '📜 Server-Regeln',
        description: '1. Respektvoller Umgang — keine Beleidigungen\n2. Kein Spam oder Werbung\n3. Keine NSFW-Inhalte außerhalb 18+-Bereiche\n4. Anweisungen des Teams befolgen\n5. Have fun! 🎮',
      }],
    });

    await chTickets.send({
      embeds: [{
        color: 0x7c5cfc,
        title: '🎫 Support-Tickets',
        description: 'Klicke auf den Button unten, um ein privates Ticket zu erstellen. Unser Team hilft dir schnellstmöglich.',
      }],
      components: [
        new ActionRowBuilder().addComponents(
          new ButtonBuilder().setCustomId(TICKET_BUTTON).setLabel('Ticket erstellen').setStyle(ButtonStyle.Primary).setEmoji('🎫')
        ),
      ],
    });

    await chVerify.send({
      embeds: [{
        color: 0x7c5cfc,
        title: '🔞 Altersverifizierung',
        description: 'Bestätige mit dem Button unten, dass du **18 Jahre oder älter** bist, um Zugang zu 18+-Bereichen zu erhalten.',
      }],
      components: [
        new ActionRowBuilder().addComponents(
          new ButtonBuilder().setCustomId(VERIFY_BUTTON).setLabel('Ich bin 18+').setStyle(ButtonStyle.Success).setEmoji('✅')
        ),
      ],
    });

    const communityPanel = {
      embeds: [{
        color: 0x7c5cfc,
        title: '🎮 Community-Rollen',
        description: 'Wähle deine Interessen aus der Liste unten — du kannst mehrere Rollen auswählen.',
      }],
    };
    if (communityRoles.length) {
      communityPanel.components = [
        new ActionRowBuilder().addComponents(
          new StringSelectMenuBuilder()
            .setCustomId(COMMUNITY_SELECT)
            .setPlaceholder('Interessen wählen…')
            .setMinValues(0)
            .setMaxValues(Math.min(4, communityRoles.length))
            .addOptions(
              communityRoles.map((role) =>
                new StringSelectMenuOptionBuilder().setLabel(role.name).setValue(role.id)
              )
            )
        ),
      ];
    }
    await chChat.send(communityPanel);

    await chBewerbung.send({
      embeds: [{
        color: 0x7c5cfc,
        title: '📝 Team-Bewerbung',
        description: 'Du möchtest Teil unseres Teams werden? Erstelle ein Ticket in **#tickets** und beschreibe, warum du Moderator oder Support werden möchtest.',
      }],
    });

    await interaction.editReply({
      content: `✅ Server eingerichtet!\n\n**Rollen:** ${ROLE_DEFS.map((r) => r.name).join(', ')}\n**Staff-Channel:** ${chStaff}`,
    });
  },
};
