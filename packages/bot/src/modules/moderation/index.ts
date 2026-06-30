import {
  SlashCommandBuilder,
  PermissionFlagsBits,
  type GuildMember,
  type ChatInputCommandInteraction,
  type Message,
} from 'discord.js';
import type { BotCommand, BotModule } from '@cleanqueue/shared';
import { store } from '../../db/store';
import { modCaseEmbed, warningEmbed } from '../../lib/ui';
import { sendUnifiedLog } from '../../lib/logging';
import { safeEditReply } from '../../lib/interactions';
import { isModerator, botNeeds } from '../../lib/permissions';
import { handleAutomodMessage } from './automod';
import { handleAntiRaidJoin, logMemberJoin } from './security';

const STRIKE_MUTE_MINUTES = 60;
const STRIKE_LIMIT = 3;

async function applyStrikeAndMaybeMute(
  interaction: ChatInputCommandInteraction,
  target: GuildMember,
  settings: ReturnType<typeof store.getGuildSettings>,
): Promise<number> {
  const record = store.getOrCreateMember(interaction.guild!.id, target.id);
  const strikes = record.strikes + 1;
  store.updateMember(interaction.guild!.id, target.id, { strikes });

  if (strikes >= STRIKE_LIMIT && settings.roles.muted) {
    await target.roles.add(settings.roles.muted, 'Automatischer Mute (3 Strikes)').catch(() => undefined);
    await target.timeout(STRIKE_MUTE_MINUTES * 60 * 1000, '3 Strikes — Auto-Mute').catch(() => undefined);
  }

  const dmText =
    strikes >= STRIKE_LIMIT
      ? `Du hast **${strikes}/${STRIKE_LIMIT} Strikes** erreicht und wurdest automatisch für **${STRIKE_MUTE_MINUTES} Minuten** stummgeschaltet.`
      : `Du hast einen Strike erhalten (**${strikes}/${STRIKE_LIMIT}**). Bei ${STRIKE_LIMIT} Strikes folgt ein Auto-Mute.`;

  await target
    .send({
      embeds: [
        warningEmbed(
          dmText + '\n\nBitte halte dich an unsere Regeln. Bei Fragen: Ticket im Support-Channel.',
          'Strike-System',
        ),
      ],
    })
    .catch(() => undefined);

  return strikes;
}

function createModCommand(
  name: string,
  description: string,
  handler: (interaction: ChatInputCommandInteraction, target: GuildMember) => Promise<void>,
): BotCommand {
  return {
    name,
    moduleId: 'moderation',
    deferReply: true,
    data: new SlashCommandBuilder()
      .setName(name)
      .setDescription(description)
      .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
      .addUserOption((o) => o.setName('user').setDescription('Ziel-Nutzer').setRequired(true))
      .addStringOption((o) => o.setName('reason').setDescription('Grund').setRequired(false)),
    async execute(interaction) {
      if (!interaction.guild || !interaction.member) {
        await safeEditReply(interaction, { content: 'Nur auf Servern verfügbar.', ephemeral: true });
        return;
      }

      const member = interaction.member as GuildMember;
      const settings = store.getGuildSettings(interaction.guild.id);
      if (!isModerator(member, settings)) {
        await safeEditReply(interaction, {
          content: 'Du benötigst Moderator-Rechte für diesen Befehl.',
          ephemeral: true,
        });
        return;
      }

      const targetUser = interaction.options.getUser('user', true);
      const target = await interaction.guild.members.fetch(targetUser.id).catch(() => null);
      if (!target) {
        await safeEditReply(interaction, { content: 'Nutzer nicht auf dem Server.', ephemeral: true });
        return;
      }

      if (target.id === interaction.user.id) {
        await safeEditReply(interaction, {
          content: 'Du kannst dich nicht selbst moderieren.',
          ephemeral: true,
        });
        return;
      }

      await handler(interaction, target);
    },
  };
}

const warnCommand = createModCommand('warn', 'Verwarnt einen Nutzer (Strike-System)', async (interaction, target) => {
  const reason = interaction.options.getString('reason') ?? 'Kein Grund';
  const settings = store.getGuildSettings(interaction.guild!.id);

  const caseRecord = store.createCase({
    guildId: interaction.guild!.id,
    targetId: target.id,
    moderatorId: interaction.user.id,
    type: 'warn',
    reason,
    status: 'open',
  });

  const strikes = await applyStrikeAndMaybeMute(interaction, target, settings);

  await sendUnifiedLog(
    interaction.guild!,
    'mod',
    'Verwarnung',
    `${target} wurde verwarnt.`,
    [
      { name: 'Case', value: `#${caseRecord.caseNumber}`, inline: true },
      { name: 'Moderator', value: `${interaction.user}`, inline: true },
      { name: 'Strikes', value: `${strikes}/${STRIKE_LIMIT}`, inline: true },
      { name: 'Grund', value: reason },
    ],
  );

  const modLogs = settings.channels.modLogs;
  if (modLogs) {
    const ch = interaction.guild!.channels.cache.get(modLogs);
    if (ch?.isTextBased()) {
      await ch.send({
        embeds: [
          modCaseEmbed({
            caseNumber: caseRecord.caseNumber,
            type: 'warn',
            targetTag: target.user.tag,
            moderatorTag: interaction.user.tag,
            reason,
            strikes: `${strikes}/${STRIKE_LIMIT}`,
          }),
        ],
      });
    }
  }

  await target
    .send({
      embeds: [
        warningEmbed(
          `Du wurdest auf **${interaction.guild!.name}** verwarnt.\n\n` +
            `**Case:** #${caseRecord.caseNumber}\n**Grund:** ${reason}\n**Strikes:** ${strikes}/${STRIKE_LIMIT}`,
          'Verwarnung erhalten',
        ),
      ],
    })
    .catch(() => undefined);

  await safeEditReply(interaction, {
    embeds: [
      modCaseEmbed({
        caseNumber: caseRecord.caseNumber,
        type: 'warn',
        targetTag: target.user.tag,
        moderatorTag: interaction.user.tag,
        reason: `${reason}\n\nStrikes: ${strikes}/${STRIKE_LIMIT}`,
        strikes: `${strikes}/${STRIKE_LIMIT}`,
      }),
    ],
  });
});

const muteCommand = createModCommand('mute', 'Stummschaltet einen Nutzer (Timeout 60 Min)', async (interaction, target) => {
  const reason = interaction.options.getString('reason') ?? 'Kein Grund';
  const settings = store.getGuildSettings(interaction.guild!.id);
  const err = botNeeds(interaction.member as GuildMember, [PermissionFlagsBits.ModerateMembers]);
  if (err) {
    await safeEditReply(interaction, { content: err, ephemeral: true });
    return;
  }

  await target.timeout(60 * 60 * 1000, reason);
  if (settings.roles.muted) await target.roles.add(settings.roles.muted, reason).catch(() => undefined);

  const caseRecord = store.createCase({
    guildId: interaction.guild!.id,
    targetId: target.id,
    moderatorId: interaction.user.id,
    type: 'mute',
    reason,
    status: 'open',
    duration: 60,
  });

  await sendUnifiedLog(interaction.guild!, 'mod', 'Mute', `${target} stummgeschaltet.`, [
    { name: 'Case', value: `#${caseRecord.caseNumber}`, inline: true },
    { name: 'Grund', value: reason },
  ]);

  await safeEditReply(interaction, {
    embeds: [
      modCaseEmbed({
        caseNumber: caseRecord.caseNumber,
        type: 'mute',
        targetTag: target.user.tag,
        moderatorTag: interaction.user.tag,
        reason,
      }),
    ],
  });
});

const kickCommand = createModCommand('kick', 'Kickt einen Nutzer vom Server', async (interaction, target) => {
  const reason = interaction.options.getString('reason') ?? 'Kein Grund';
  const err = botNeeds(interaction.member as GuildMember, [PermissionFlagsBits.KickMembers]);
  if (err) {
    await safeEditReply(interaction, { content: err, ephemeral: true });
    return;
  }

  const caseRecord = store.createCase({
    guildId: interaction.guild!.id,
    targetId: target.id,
    moderatorId: interaction.user.id,
    type: 'kick',
    reason,
    status: 'closed',
  });

  await sendUnifiedLog(interaction.guild!, 'mod', 'Kick', `${target.user.tag} gekickt.`, [
    { name: 'Case', value: `#${caseRecord.caseNumber}`, inline: true },
    { name: 'Grund', value: reason },
  ]);

  await target.kick(reason);
  await safeEditReply(interaction, {
    embeds: [
      modCaseEmbed({
        caseNumber: caseRecord.caseNumber,
        type: 'kick',
        targetTag: target.user.tag,
        moderatorTag: interaction.user.tag,
        reason,
      }),
    ],
  });
});

const banCommand = createModCommand('ban', 'Bannt einen Nutzer', async (interaction, target) => {
  const reason = interaction.options.getString('reason') ?? 'Kein Grund';
  const err = botNeeds(interaction.member as GuildMember, [PermissionFlagsBits.BanMembers]);
  if (err) {
    await safeEditReply(interaction, { content: err, ephemeral: true });
    return;
  }

  const caseRecord = store.createCase({
    guildId: interaction.guild!.id,
    targetId: target.id,
    moderatorId: interaction.user.id,
    type: 'ban',
    reason,
    status: 'closed',
  });

  await sendUnifiedLog(interaction.guild!, 'mod', 'Ban', `${target.user.tag} gebannt.`, [
    { name: 'Case', value: `#${caseRecord.caseNumber}`, inline: true },
    { name: 'Grund', value: reason },
  ]);

  await target.ban({ reason });
  await safeEditReply(interaction, {
    embeds: [
      modCaseEmbed({
        caseNumber: caseRecord.caseNumber,
        type: 'ban',
        targetTag: target.user.tag,
        moderatorTag: interaction.user.tag,
        reason,
      }),
    ],
  });
});

const timeoutCommand = createModCommand('timeout', 'Timeout für einen Nutzer (10 Min)', async (interaction, target) => {
  const reason = interaction.options.getString('reason') ?? 'Kein Grund';
  const minutes = 10;
  const err = botNeeds(interaction.member as GuildMember, [PermissionFlagsBits.ModerateMembers]);
  if (err) {
    await safeEditReply(interaction, { content: err, ephemeral: true });
    return;
  }

  await target.timeout(minutes * 60 * 1000, reason);

  const caseRecord = store.createCase({
    guildId: interaction.guild!.id,
    targetId: target.id,
    moderatorId: interaction.user.id,
    type: 'timeout',
    reason,
    status: 'open',
    duration: minutes,
  });

  await sendUnifiedLog(interaction.guild!, 'mod', 'Timeout', `${target} Timeout (${minutes} Min).`, [
    { name: 'Case', value: `#${caseRecord.caseNumber}`, inline: true },
    { name: 'Grund', value: reason },
  ]);

  await safeEditReply(interaction, {
    embeds: [
      modCaseEmbed({
        caseNumber: caseRecord.caseNumber,
        type: 'timeout',
        targetTag: target.user.tag,
        moderatorTag: interaction.user.tag,
        reason: `${reason} (${minutes} Min.)`,
      }),
    ],
  });
});

const modCommand: BotCommand = {
  name: 'mod',
  moduleId: 'moderation',
  deferReply: true,
  data: new SlashCommandBuilder()
    .setName('mod')
    .setDescription('Moderations-Toolkit — Warn, Mute, Kick, Ban, Timeout, History')
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
    .addSubcommand((sub) =>
      sub
        .setName('warn')
        .setDescription('Verwarnt einen Nutzer (Strike-System)')
        .addUserOption((o) => o.setName('user').setDescription('Ziel-Nutzer').setRequired(true))
        .addStringOption((o) => o.setName('reason').setDescription('Grund').setRequired(false)),
    )
    .addSubcommand((sub) =>
      sub
        .setName('mute')
        .setDescription('Stummschaltet einen Nutzer (60 Min)')
        .addUserOption((o) => o.setName('user').setDescription('Ziel-Nutzer').setRequired(true))
        .addStringOption((o) => o.setName('reason').setDescription('Grund').setRequired(false)),
    )
    .addSubcommand((sub) =>
      sub
        .setName('kick')
        .setDescription('Kickt einen Nutzer')
        .addUserOption((o) => o.setName('user').setDescription('Ziel-Nutzer').setRequired(true))
        .addStringOption((o) => o.setName('reason').setDescription('Grund').setRequired(false)),
    )
    .addSubcommand((sub) =>
      sub
        .setName('ban')
        .setDescription('Bannt einen Nutzer')
        .addUserOption((o) => o.setName('user').setDescription('Ziel-Nutzer').setRequired(true))
        .addStringOption((o) => o.setName('reason').setDescription('Grund').setRequired(false)),
    )
    .addSubcommand((sub) =>
      sub
        .setName('timeout')
        .setDescription('Timeout (10 Min)')
        .addUserOption((o) => o.setName('user').setDescription('Ziel-Nutzer').setRequired(true))
        .addStringOption((o) => o.setName('reason').setDescription('Grund').setRequired(false)),
    )
    .addSubcommand((sub) =>
      sub
        .setName('history')
        .setDescription('Moderations-Historie eines Nutzers')
        .addUserOption((o) => o.setName('user').setDescription('Ziel-Nutzer').setRequired(true)),
    )
    .addSubcommand((sub) =>
      sub
        .setName('note')
        .setDescription('Interne Moderations-Notiz')
        .addUserOption((o) => o.setName('user').setDescription('Ziel-Nutzer').setRequired(true))
        .addStringOption((o) =>
          o.setName('text').setDescription('Notiz-Text').setRequired(true).setMaxLength(500),
        ),
    ),
  async execute(interaction) {
    const sub = interaction.options.getSubcommand();

    if (sub === 'warn') return warnCommand.execute(interaction);
    if (sub === 'mute') return muteCommand.execute(interaction);
    if (sub === 'kick') return kickCommand.execute(interaction);
    if (sub === 'ban') return banCommand.execute(interaction);
    if (sub === 'timeout') return timeoutCommand.execute(interaction);

    if (!interaction.guild || !interaction.member) {
      await safeEditReply(interaction, { content: 'Nur auf Servern.', ephemeral: true });
      return;
    }

    const settings = store.getGuildSettings(interaction.guild.id);
    if (!isModerator(interaction.member as GuildMember, settings)) {
      await safeEditReply(interaction, { content: 'Keine Berechtigung.', ephemeral: true });
      return;
    }

    if (sub === 'history') {
      const user = interaction.options.getUser('user', true);
      const cases = store.getCasesForUser(interaction.guild.id, user.id).filter((c) => c.type !== 'note');

      const lines =
        cases.length === 0
          ? 'Keine Einträge.'
          : cases
              .slice(0, 15)
              .map(
                (c) =>
                  `**#${c.caseNumber}** \`${c.type}\` — ${c.reason ?? '—'} (<t:${Math.floor(new Date(c.createdAt).getTime() / 1000)}:d>)`,
              )
              .join('\n');

      await safeEditReply(interaction, {
        embeds: [
          modCaseEmbed({
            caseNumber: cases[0]?.caseNumber ?? 0,
            type: 'history',
            targetTag: user.tag,
            moderatorTag: '—',
            reason: lines,
          }).setTitle(`🛡️ Mod-History — ${user.tag}`),
        ],
      });
      return;
    }

    if (sub === 'note') {
      const user = interaction.options.getUser('user', true);
      const text = interaction.options.getString('text', true);

      const caseRecord = store.createCase({
        guildId: interaction.guild.id,
        targetId: user.id,
        moderatorId: interaction.user.id,
        type: 'note',
        reason: text,
        status: 'open',
      });

      await sendUnifiedLog(interaction.guild, 'mod', 'Mod-Notiz', `Notiz für ${user.tag}`, [
        { name: 'Case', value: `#${caseRecord.caseNumber}`, inline: true },
        { name: 'Moderator', value: `${interaction.user}`, inline: true },
        { name: 'Notiz', value: text },
      ]);

      await safeEditReply(interaction, {
        embeds: [
          modCaseEmbed({
            caseNumber: caseRecord.caseNumber,
            type: 'note',
            targetTag: user.tag,
            moderatorTag: interaction.user.tag,
            reason: text,
          }),
        ],
      });
    }
  },
};

export const moderationModule: BotModule = {
  id: 'moderation',
  label: 'Moderation',
  phase: 2,
  enabled: true,
  description: 'AutoMod, Warn/Mute/Kick/Ban, Cases, Anti-Raid, Quarantine',
  commands: [modCommand],
  events: [
    {
      name: 'messageCreate',
      async execute(message: Message) {
        await handleAutomodMessage(message);
      },
    },
    {
      name: 'guildMemberAdd',
      async execute(member: GuildMember) {
        await logMemberJoin(member);
        await handleAntiRaidJoin(member);
      },
    },
  ],
};
