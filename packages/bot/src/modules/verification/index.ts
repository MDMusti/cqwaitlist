import type { BotModule, ComponentHandler } from '@cleanqueue/shared';
import type { GuildMember, Interaction } from 'discord.js';
import { store } from '../../db/store';
import { errorEmbed, successEmbed } from '../../lib/embeds';
import { buildCaptchaModal } from './panel';

const MIN_ACCOUNT_AGE_DAYS = 7;

function randomCaptcha(): { a: number; b: number } {
  return { a: Math.floor(Math.random() * 9) + 1, b: Math.floor(Math.random() * 9) + 1 };
}

async function handleVerifyComponent(interaction: Interaction): Promise<boolean> {
  if (!interaction.guild || !interaction.member) return false;

  if (interaction.isButton() && interaction.customId === 'verify:start') {
    const settings = store.getGuildSettings(interaction.guild.id);
    const member = interaction.member as GuildMember;
    const minDays = settings.verification?.minAccountAgeDays ?? MIN_ACCOUNT_AGE_DAYS;
    const accountAgeDays =
      (Date.now() - member.user.createdTimestamp) / (1000 * 60 * 60 * 24);

    if (accountAgeDays < minDays) {
      await interaction.reply({
        embeds: [
          errorEmbed(
            `Dein Account muss mindestens **${minDays} Tage** alt sein (aktuell: ~${Math.floor(accountAgeDays)} Tage).`,
          ),
        ],
        ephemeral: true,
      });
      return true;
    }

    const record = store.getMember(interaction.guild.id, member.id);
    if (record?.verified) {
      await interaction.reply({
        embeds: [errorEmbed('Du bist bereits verifiziert.')],
        ephemeral: true,
      });
      return true;
    }

    const { a, b } = randomCaptcha();
    store.setCaptcha(member.id, a + b);
    await interaction.showModal(buildCaptchaModal(a, b));
    return true;
  }

  if (interaction.isModalSubmit() && interaction.customId.startsWith('verify:captcha:')) {
    const member = interaction.member as GuildMember;
    const answerRaw = interaction.fields.getTextInputValue('answer').trim();
    const answer = parseInt(answerRaw, 10);

    if (Number.isNaN(answer) || !store.verifyCaptcha(member.id, answer)) {
      await interaction.reply({
        embeds: [errorEmbed('Falsche Antwort oder abgelaufen. Bitte erneut versuchen.')],
        ephemeral: true,
      });
      return true;
    }

    const settings = store.getGuildSettings(interaction.guild!.id);
    const verifiedRoleId = settings.roles.verified18;
    const memberRoleId = settings.roles.member;

    if (verifiedRoleId) {
      await member.roles.add(verifiedRoleId, 'CleanQueue Verifizierung').catch(() => undefined);
    }
    if (memberRoleId) {
      await member.roles.add(memberRoleId, 'CleanQueue Verifizierung').catch(() => undefined);
    }

    store.updateMember(interaction.guild!.id, member.id, {
      verified: true,
      verifiedAt: new Date().toISOString(),
    });

    await interaction.reply({
      embeds: [successEmbed('Verifizierung erfolgreich! Willkommen in der Community.')],
      ephemeral: true,
    });
    return true;
  }

  return false;
}

export const verificationModule: BotModule = {
  id: 'verification',
  label: 'Verification',
  phase: 2,
  enabled: true,
  description: '18+ Gate, Captcha-Modal, Account-Alter, Member-Screening',
  componentHandlers: [handleVerifyComponent as ComponentHandler],
  events: [
    {
      name: 'guildMemberAdd',
      async execute(member: GuildMember) {
        store.getOrCreateMember(member.guild.id, member.id);
        const settings = store.getGuildSettings(member.guild.id);
        const verifiedRoleId = settings.roles.verified18;
        if (verifiedRoleId && !member.roles.cache.has(verifiedRoleId)) {
          const verifyCh = settings.channels.verify;
          if (verifyCh) {
            for (const ch of member.guild.channels.cache.filter((c) => c.isTextBased() && !c.isThread()).values()) {
              if (ch.id === verifyCh || ch.id === settings.channels.rules) continue;
              if ('permissionOverwrites' in ch) {
                await ch.permissionOverwrites
                  .edit(member.id, { ViewChannel: false })
                  .catch(() => undefined);
              }
            }
            const verifyChannel = member.guild.channels.cache.get(verifyCh);
            if (verifyChannel && 'permissionOverwrites' in verifyChannel) {
              await verifyChannel.permissionOverwrites
                .edit(member.id, { ViewChannel: true })
                .catch(() => undefined);
            }
          }
        }
      },
    },
  ],
};
