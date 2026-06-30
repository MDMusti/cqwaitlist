import type { BotModule, ComponentHandler } from '@cleanqueue/shared';
import type { GuildMember, Interaction } from 'discord.js';
import { store } from '../../db/store';
import { errorEmbed, rulesEmbed, successEmbed } from '../../lib/ui';
import { restoreMemberChannelAccess, restrictUnverifiedMember } from '../../lib/channels';
import { sendUnifiedLog } from '../../lib/logging';
import { buildCaptchaModal, buildRulesAcceptRow } from './panel';

const MIN_ACCOUNT_AGE_DAYS = 7;

function randomCaptcha(): { a: number; b: number } {
  return { a: Math.floor(Math.random() * 9) + 1, b: Math.floor(Math.random() * 9) + 1 };
}

async function completeVerification(member: GuildMember, guildId: string): Promise<void> {
  const settings = store.getGuildSettings(guildId);

  if (settings.roles.verified18) {
    await member.roles.add(settings.roles.verified18, 'CleanQueue Verifizierung').catch(() => undefined);
  }
  if (settings.roles.member) {
    await member.roles.add(settings.roles.member, 'CleanQueue Verifizierung').catch(() => undefined);
  }
  if (settings.roles.quarantine && member.roles.cache.has(settings.roles.quarantine)) {
    await member.roles.remove(settings.roles.quarantine, 'Verifizierung abgeschlossen').catch(() => undefined);
  }

  await restoreMemberChannelAccess(member, settings);

  store.updateMember(guildId, member.id, {
    verified: true,
    verifiedAt: new Date().toISOString(),
  });

  await sendUnifiedLog(
    member.guild,
    'member',
    'Verifizierung abgeschlossen',
    `${member.user.tag} hat die Verifizierung bestanden.`,
    [{ name: 'Nutzer', value: `${member}`, inline: true }],
  );
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

    await interaction.reply({
      embeds: [
        rulesEmbed().setDescription(
          '**Schritt 1 & 2:** Lies die Regeln und akzeptiere sie unten.\n\n' +
            'Unsere Community lebt von **Respekt**, **Sicherheit** und **Transparenz**. ' +
            'Mit dem Klick auf „Regeln akzeptieren" bestätigst du, dass du mindestens **18 Jahre** alt bist ' +
            'und die Server-Regeln einhältst.',
        ),
      ],
      components: [buildRulesAcceptRow()],
      ephemeral: true,
    });
    return true;
  }

  if (interaction.isButton() && interaction.customId === 'verify:rules') {
    const member = interaction.member as GuildMember;
    store.setVerifyAccepted(member.id);
    const { a, b } = randomCaptcha();
    store.setCaptcha(member.id, a + b);
    await interaction.showModal(buildCaptchaModal(a, b));
    return true;
  }

  if (interaction.isModalSubmit() && interaction.customId.startsWith('verify:captcha:')) {
    const member = interaction.member as GuildMember;

    if (!store.hasVerifyAccepted(member.id)) {
      await interaction.reply({
        embeds: [errorEmbed('Bitte akzeptiere zuerst die Regeln.')],
        ephemeral: true,
      });
      return true;
    }

    const answerRaw = interaction.fields.getTextInputValue('answer').trim();
    const answer = parseInt(answerRaw, 10);

    if (Number.isNaN(answer) || !store.verifyCaptcha(member.id, answer)) {
      await interaction.reply({
        embeds: [errorEmbed('Falsche Antwort oder abgelaufen. Bitte erneut versuchen.')],
        ephemeral: true,
      });
      return true;
    }

    await completeVerification(member, interaction.guild!.id);

    await interaction.reply({
      embeds: [
        successEmbed(
          'Verifizierung erfolgreich! Du hast jetzt Zugang zu allen Channels. Willkommen in der Community.',
        ),
      ],
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
  description: 'Multi-Step Verify: Regeln + Captcha, Channel-Restore',
  componentHandlers: [handleVerifyComponent as ComponentHandler],
  events: [
    {
      name: 'guildMemberAdd',
      async execute(member: GuildMember) {
        store.getOrCreateMember(member.guild.id, member.id);
        const settings = store.getGuildSettings(member.guild.id);
        const verifiedRoleId = settings.roles.verified18;
        if (verifiedRoleId && !member.roles.cache.has(verifiedRoleId)) {
          await restrictUnverifiedMember(member, settings);
        }
      },
    },
  ],
};
