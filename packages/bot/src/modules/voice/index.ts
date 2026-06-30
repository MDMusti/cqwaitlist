import {
  ChannelType,
  PermissionFlagsBits,
  type GuildMember,
  type Interaction,
  type VoiceState,
} from 'discord.js';
import type { BotModule, ComponentHandler } from '@cleanqueue/shared';
import { store } from '../../db/store';
import { errorEmbed, successEmbed } from '../../lib/embeds';

async function handleVoiceControl(interaction: Interaction): Promise<boolean> {
  if (!interaction.guild || !interaction.isButton()) return false;
  if (!interaction.customId.startsWith('voice:')) return false;

  const temp = store.getTempVoice(interaction.guild.id);
  if (!temp) {
    await interaction.reply({ embeds: [errorEmbed('Kein aktiver Temp-Voice.')], ephemeral: true });
    return true;
  }

  const member = interaction.member as GuildMember;
  if (temp.ownerId !== member.id && !member.permissions.has(PermissionFlagsBits.ManageChannels)) {
    await interaction.reply({ embeds: [errorEmbed('Nur der Channel-Owner.')], ephemeral: true });
    return true;
  }

  const channel = interaction.guild.channels.cache.get(temp.channelId);
  if (!channel?.isVoiceBased()) {
    await interaction.reply({ embeds: [errorEmbed('Voice-Channel nicht gefunden.')], ephemeral: true });
    return true;
  }

  if (interaction.customId === 'voice:lock') {
    await channel.permissionOverwrites.edit(interaction.guild.roles.everyone, { Connect: false });
    await interaction.reply({ embeds: [successEmbed('Channel gesperrt.')], ephemeral: true });
    return true;
  }

  if (interaction.customId === 'voice:unlock') {
    await channel.permissionOverwrites.edit(interaction.guild.roles.everyone, { Connect: true });
    await interaction.reply({ embeds: [successEmbed('Channel entsperrt.')], ephemeral: true });
    return true;
  }

  return false;
}

export const voiceModule: BotModule = {
  id: 'voice',
  label: 'Voice',
  phase: 3,
  enabled: true,
  description: 'Temp Voice — dynamische private Sprachkanäle',
  componentHandlers: [handleVoiceControl as ComponentHandler],
  events: [
    {
      name: 'voiceStateUpdate',
      async execute(oldState: VoiceState, newState: VoiceState) {
        const guild = newState.guild ?? oldState.guild;
        const settings = store.getGuildSettings(guild.id);
        const createId = settings.channels.createVoice;
        const categoryId = settings.channels.voiceCategory;

        // Delete empty temp channel
        const temp = store.getTempVoice(guild.id);
        if (temp) {
          const ch = guild.channels.cache.get(temp.channelId);
          if (ch?.isVoiceBased() && ch.members.size === 0) {
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
            { id: guild.roles.everyone.id, allow: [PermissionFlagsBits.Connect] },
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

        store.setTempVoice(guild.id, channel.id, member.id);
        await member.voice.setChannel(channel).catch(() => undefined);
      },
    },
  ],
};
