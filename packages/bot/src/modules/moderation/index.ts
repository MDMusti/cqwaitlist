import {
  SlashCommandBuilder,
  PermissionFlagsBits,
  type GuildMember,
  type ChatInputCommandInteraction,
} from 'discord.js';
import type { BotCommand, BotModule } from '@cleanqueue/shared';
import { store } from '../../db/store';
import { modCaseEmbed } from '../../lib/embeds';
import { sendGuildLog } from '../../lib/logging';
import { botNeeds, requireModerator } from '../../lib/permissions';

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
    data: new SlashCommandBuilder()
      .setName(name)
      .setDescription(description)
      .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
      .addUserOption((o) => o.setName('user').setDescription('Ziel-Nutzer').setRequired(true))
      .addStringOption((o) => o.setName('reason').setDescription('Grund').setRequired(false)),
    async execute(interaction) {
      const ctx = await requireModerator(interaction);
      if (!ctx) return;

      const targetUser = interaction.options.getUser('user', true);
      const target = await interaction.guild!.members.fetch(targetUser.id).catch(() => null);
      if (!target) {
        await interaction.reply({ content: 'Nutzer nicht auf dem Server.', ephemeral: true });
        return;
      }

      if (target.id === interaction.user.id) {
        await interaction.reply({ content: 'Du kannst dich nicht selbst moderieren.', ephemeral: true });
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

  await sendGuildLog(
    interaction.guild!,
    'Warnung',
    `${target} wurde verwarnt.`,
    [
      { name: 'Case', value: `#${caseRecord.caseNumber}`, inline: true },
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
          }),
        ],
      });
    }
  }

  await interaction.reply({
    embeds: [
      modCaseEmbed({
        caseNumber: caseRecord.caseNumber,
        type: 'warn',
        targetTag: target.user.tag,
        moderatorTag: interaction.user.tag,
        reason: `${reason}\n\nStrikes: ${strikes}/${STRIKE_LIMIT}`,
      }),
    ],
  });
});

const muteCommand = createModCommand('mute', 'Stummschaltet einen Nutzer (Timeout 60 Min)', async (interaction, target) => {
  const reason = interaction.options.getString('reason') ?? 'Kein Grund';
  const settings = store.getGuildSettings(interaction.guild!.id);
  const err = botNeeds(interaction.member as GuildMember, [PermissionFlagsBits.ModerateMembers]);
  if (err) {
    await interaction.reply({ content: err, ephemeral: true });
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

  await interaction.reply({
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
    await interaction.reply({ content: err, ephemeral: true });
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

  await target.kick(reason);
  await interaction.reply({
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
    await interaction.reply({ content: err, ephemeral: true });
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

  await target.ban({ reason });
  await interaction.reply({
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

const timeoutCommand = createModCommand('timeout', 'Timeout für einen Nutzer (Minuten)', async (interaction, target) => {
  const reason = interaction.options.getString('reason') ?? 'Kein Grund';
  const minutes = 10;
  const err = botNeeds(interaction.member as GuildMember, [PermissionFlagsBits.ModerateMembers]);
  if (err) {
    await interaction.reply({ content: err, ephemeral: true });
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

  await interaction.reply({
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

export const moderationModule: BotModule = {
  id: 'moderation',
  label: 'Moderation',
  phase: 2,
  enabled: true,
  description: 'Warn, Mute, Kick, Ban, Timeout, Strike-System, Cases',
  commands: [warnCommand, muteCommand, kickCommand, banCommand, timeoutCommand],
};
