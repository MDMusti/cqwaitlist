import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
} from 'discord.js';
import { rulesEmbed, EMOJI } from '../../lib/ui';

export function buildVerifyPanel() {
  const embed = rulesEmbed()
    .setTitle(`${EMOJI.verify} Verifizierung — 18+`)
    .setDescription(
      'Willkommen! Um Zugang zum Server zu erhalten, durchlaufe die **3 Schritte**:\n\n' +
        '**1.** Server-Regeln lesen\n' +
        '**2.** Regeln akzeptieren\n' +
        '**3.** Sicherheits-Captcha lösen\n\n' +
        'Klicke auf **Verifizierung starten**.',
    );

  const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId('verify:start')
      .setLabel('Verifizierung starten')
      .setStyle(ButtonStyle.Success)
      .setEmoji('✅'),
  );

  return { embeds: [embed], components: [row] };
}

export function buildRulesAcceptRow() {
  return new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId('verify:rules')
      .setLabel('Regeln akzeptieren')
      .setStyle(ButtonStyle.Primary)
      .setEmoji('📜'),
  );
}

export function buildCaptchaModal(a: number, b: number): ModalBuilder {
  return new ModalBuilder()
    .setCustomId(`verify:captcha:${a}:${b}`)
    .setTitle('Schritt 3 — Sicherheitsprüfung')
    .addComponents(
      new ActionRowBuilder<TextInputBuilder>().addComponents(
        new TextInputBuilder()
          .setCustomId('answer')
          .setLabel(`Was ist ${a} + ${b}?`)
          .setStyle(TextInputStyle.Short)
          .setRequired(true)
          .setMaxLength(4)
          .setPlaceholder('Deine Antwort'),
      ),
    );
}
