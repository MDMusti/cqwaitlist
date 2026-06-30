import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
} from 'discord.js';
import { brandEmbed } from '../../lib/embeds';

export function buildVerifyPanel() {
  const embed = brandEmbed('🔐 Verifizierung — 18+')
    .setDescription(
      'Willkommen! Um Zugang zum Server zu erhalten, bestätige bitte:\n\n' +
        '• Du bist **mindestens 18 Jahre alt**\n' +
        '• Du akzeptierst die Server-Regeln\n' +
        '• Dein Discord-Account erfüllt das Mindestalter\n\n' +
        'Klicke auf **Verifizieren** und löse die kurze Aufgabe.',
    );

  const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId('verify:start')
      .setLabel('Verifizieren')
      .setStyle(ButtonStyle.Success)
      .setEmoji('✅'),
  );

  return { embeds: [embed], components: [row] };
}

export function buildCaptchaModal(a: number, b: number): ModalBuilder {
  return new ModalBuilder()
    .setCustomId(`verify:captcha:${a}:${b}`)
    .setTitle('Sicherheitsprüfung')
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
