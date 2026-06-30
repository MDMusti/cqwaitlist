import {
  ChannelType,
  PermissionFlagsBits,
  type GuildMember,
  type Interaction,
  type VoiceState,
} from 'discord.js';
import type { BotModule, ComponentHandler } from '@cleanqueue/shared';
import { store } from '../../db/store';
import { errorEmbed, successEmbed } from '../../lib/ui';
import { buildVoiceControlPanel, buildVoiceModal } from './panel';

async function assertVoiceOwner(interaction: Interaction): Promise<{
  member: GuildMember;
  channel: import('discord.js').VoiceChannel;
} | null> {
  if (!interaction.guild || !interaction.member || !interaction.isRepliable()) return null;

  const temp = store.getTempVoice(interaction.guild.id);
  if (!temp) {
    await interaction.reply({ embeds: [errorEmbed('Kein aktiver Temp-Voice.')], ephemeral: true });
    return null;
  }

  const member = interaction.member as GuildMember;
  if (temp.ownerId !== member.id && !member.permissions.has(PermissionFlagsBits.ManageChannels)) {
    await interaction.reply({ embeds: [errorEmbed('Nur der Channel-Owner oder Mods.')], ephemeral: true });
    return null;
  }

  const channel = interaction.guild.channels.cache.get(temp.channelId);
  if (!channel || channel.type !== ChannelType.GuildVoice) {
    await interaction.reply({ embeds: [errorEmbed('Voice-Channel nicht gefunden.')], ephemeral: true });
    return null;
  }

  return { member, channel };
}

async function handleVoiceControl(interaction: Interaction): Promise<boolean> {
  if (!interaction.guild || !interaction.isButton()) return false;
  if (!interaction.customId.startsWith('voice:')) return false;

  const modalTypes = ['limit', 'rename', 'trust', 'block', 'bitrate'] as const;
  for (const type of modalTypes) {
    if (interaction.customId === `voice:${type}`) {
      await interaction.showModal(buildVoiceModal(type));
      return true;
    }
  }

  const ctx = await assertVoiceOwner(interaction);
  if (!ctx) return true;
  const { channel } = ctx;
  const guild = interaction.guild;

  if (interaction.customId === 'voice:lock') {
    await channel.permissionOverwrites.edit(guild.roles.everyone, { Connect: false });
    await interaction.reply({ embeds: [successEmbed('Channel gesperrt — niemand kann beitreten.')], ephemeral: true });
    return true;
  }

  if (interaction.customId === 'voice:unlock') {
    await channel.permissionOverwrites.edit(guild.roles.everyone, { Connect: true });
    await interaction.reply({ embeds: [successEmbed('Channel entsperrt.')], ephemeral: true });
    return true;
  }

  if (interaction.customId === 'voice:hide') {
    await channel.permissionOverwrites.edit(guild.roles.everyone, { ViewChannel: false });
    store.updateTempVoice(guild.id, { hidden: true });
    await interaction.reply({ embeds: [successEmbed('Channel ist jetzt versteckt.')], ephemeral: true });
    return true;
  }

  if (interaction.customId === 'voice:show') {
    await channel.permissionOverwrites.edit(guild.roles.everyone, { ViewChannel: true });
    store.updateTempVoice(guild.id, { hidden: false });
    await interaction.reply({ embeds: [successEmbed('Channel ist wieder sichtbar.')], ephemeral: true });
    return true;
  }

  return false;
}

async function handleVoiceModal(interaction: Interaction): Promise<boolean> {
  if (!interaction.isModalSubmit() || !interaction.customId.startsWith('voice:modal:')) return false;

  const ctx = await assertVoiceOwner(interaction);
  if (!ctx) return true;
  const { channel } = ctx;
  const guild = interaction.guild!;
  const value = interaction.fields.getTextInputValue('value').trim();
  const type = interaction.customId.replace('voice:modal:', '');

  if (type === 'limit') {
    const limit = parseInt(value, 10);
    if (Number.isNaN(limit) || limit < 0 || limit > 99) {
      await interaction.reply({ embeds: [errorEmbed('Ungültiges Limit (0–99).')], ephemeral: true });
      return true;
    }
    await channel.setUserLimit(limit);
    store.updateTempVoice(guild.id, { userLimit: limit });
    await interaction.reply({ embeds: [successEmbed(`Nutzerlimit: **${limit || 'unbegrenzt'}**`)], ephemeral: true });
    return true;
  }

  if (type === 'rename') {
    await channel.setName(value.slice(0, 100));
    await interaction.reply({ embeds: [successEmbed(`Umbenannt zu **${value}**`)], ephemeral: true });
    return true;
  }

  if (type === 'trust' || type === 'block') {
    const userId = value.replace(/[<@!>]/g, '');
    const target = await guild.members.fetch(userId).catch(() => null);
    if (!target) {
      await interaction.reply({ embeds: [errorEmbed('Nutzer nicht gefunden.')], ephemeral: true });
      return true;
    }

    const temp = store.getTempVoice(guild.id)!;
    if (type === 'trust') {
      await channel.permissionOverwrites.edit(target.id, { Connect: true, ViewChannel: true });
      const trusted = [...(temp.trusted ?? []), target.id];
      store.updateTempVoice(guild.id, { trusted });
      await interaction.reply({ embeds: [successEmbed(`${target} darf beitreten.`)], ephemeral: true });
    } else {
      await channel.permissionOverwrites.edit(target.id, { Connect: false, ViewChannel: false });
      const blocked = [...(temp.blocked ?? []), target.id];
      store.updateTempVoice(guild.id, { blocked });
      if (target.voice.channelId === channel.id) {
        await target.voice.disconnect().catch(() => undefined);
      }
      await interaction.reply({ embeds: [successEmbed(`${target} wurde blockiert.`)], ephemeral: true });
    }
    return true;
  }

  if (type === 'bitrate') {
    const kbps = parseInt(value, 10);
    if (Number.isNaN(kbps) || kbps < 8 || kbps > 96) {
      await interaction.reply({ embeds: [errorEmbed('Bitrate muss zwischen 8 und 96 kbps liegen.')], ephemeral: true });
      return true;
    }
    await channel.setBitrate(kbps * 1000);
    await interaction.reply({ embeds: [successEmbed(`Bitrate: **${kbps} kbps**`)], ephemeral: true });
    return true;
  }

  return false;
}

export const voiceModule: BotModule = {
  id: 'voice',
  label: 'Voice',
  phase: 3,
  enabled: true,
  description: 'Temp Voice — VoiceMaster Control Panel',
  componentHandlers: [handleVoiceControl as ComponentHandler, handleVoiceModal as ComponentHandler],
  events: [
    {
      name: 'voiceStateUpdate',
      async execute(oldState: VoiceState, newState: VoiceState) {
        const guild = newState.guild ?? oldState.guild;
        const settings = store.getGuildSettings(guild.id);
        const createId = settings.channels.createVoice;
        const categoryId = settings.channels.voiceCategory;

        const temp = store.getTempVoice(guild.id);
        if (temp) {
          const ch = guild.channels.cache.get(temp.channelId);
          if (ch?.isVoiceBased() && ch.members.size === 0) {
            if (temp.panelChannelId && temp.panelMessageId) {
              const panelCh = guild.channels.cache.get(temp.panelChannelId);
              if (panelCh?.isTextBased()) {
                const msg = await panelCh.messages.fetch(temp.panelMessageId).catch(() => null);
                await msg?.delete().catch(() => undefined);
              }
            }
            await ch.delete('Temp Voice leer').catch(() => undefined);
            store.removeTempVoice(guild.id);
          }
        }

        if (!createId || !newState.channelId || newState.channelId !== createId) return;
        const member = newState.member;
        if (!member || member.user.bot) return;

        const existing = store.getTempVoice(guild.id);
        if (existing?.ownerId === member.id) {
          const ch = guild.channels.cache.get(existing.channelId);
          if (ch?.isVoiceBased()) {
            await member.voice.setChannel(ch).catch(() => undefined);
            return;
          }
        }

        const channel = await guild.channels.create({
          name: `🔊 ${member.user.username}`.slice(0, 100),
          type: ChannelType.GuildVoice,
          parent: categoryId ?? undefined,
          permissionOverwrites: [
            { id: guild.roles.everyone.id, allow: [PermissionFlagsBits.Connect, PermissionFlagsBits.ViewChannel] },
            {
              id: member.id,
              allow: [
                PermissionFlagsBits.Connect,
                PermissionFlagsBits.ManageChannels,
                PermissionFlagsBits.MoveMembers,
              ],
            },
          ],
        });

        const panelTargetId =
          settings.channels.voiceControl ?? settings.channels.general ?? settings.channels.welcome;
        let panelChannelId: string | undefined;
        let panelMessageId: string | undefined;

        if (panelTargetId) {
          const panelCh = guild.channels.cache.get(panelTargetId);
          if (panelCh?.isTextBased()) {
            const panelMsg = await panelCh.send(buildVoiceControlPanel(member.user.tag));
            panelChannelId = panelCh.id;
            panelMessageId = panelMsg.id;
          }
        }

        if (panelChannelId && panelMessageId) {
          store.setTempVoice(guild.id, channel.id, member.id, { panelChannelId, panelMessageId });
        } else {
          store.setTempVoice(guild.id, channel.id, member.id);
        }
        await member.voice.setChannel(channel).catch(() => undefined);
      },
    },
  ],
};
