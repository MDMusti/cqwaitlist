import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
} from 'discord.js';
import { primaryEmbed, EMOJI } from '../../lib/ui';

export function buildVoiceControlPanel(ownerTag: string) {
  const embed = primaryEmbed(
    `${EMOJI.voice} Voice Control Panel`,
    `**Owner:** ${ownerTag}\n\nVerwalte deinen temporären Sprachkanal:`,
  ).addFields(
    { name: '🔒 Sperren', value: 'Niemand kann beitreten', inline: true },
    { name: '🔓 Entsperren', value: 'Offen für alle', inline: true },
    { name: '👁 Verstecken', value: 'Channel unsichtbar', inline: true },
    { name: '👥 Limit', value: 'Nutzerlimit setzen', inline: true },
    { name: '✏️ Umbenennen', value: 'Neuer Name', inline: true },
    { name: '✅ Vertrauen', value: 'Nutzer erlauben', inline: true },
    { name: '🚫 Blockieren', value: 'Nutzer sperren', inline: true },
    { name: '🎚 Bitrate', value: 'Audio-Qualität', inline: true },
  );

  const row1 = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder().setCustomId('voice:lock').setLabel('Sperren').setStyle(ButtonStyle.Secondary).setEmoji('🔒'),
    new ButtonBuilder().setCustomId('voice:unlock').setLabel('Entsperren').setStyle(ButtonStyle.Secondary).setEmoji('🔓'),
    new ButtonBuilder().setCustomId('voice:hide').setLabel('Verstecken').setStyle(ButtonStyle.Secondary).setEmoji('👁'),
    new ButtonBuilder().setCustomId('voice:show').setLabel('Anzeigen').setStyle(ButtonStyle.Secondary).setEmoji('👀'),
  );

  const row2 = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder().setCustomId('voice:limit').setLabel('Limit').setStyle(ButtonStyle.Primary).setEmoji('👥'),
    new ButtonBuilder().setCustomId('voice:rename').setLabel('Umbenennen').setStyle(ButtonStyle.Primary).setEmoji('✏️'),
    new ButtonBuilder().setCustomId('voice:trust').setLabel('Vertrauen').setStyle(ButtonStyle.Success).setEmoji('✅'),
    new ButtonBuilder().setCustomId('voice:block').setLabel('Blockieren').setStyle(ButtonStyle.Danger).setEmoji('🚫'),
  );

  const row3 = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder().setCustomId('voice:bitrate').setLabel('Bitrate').setStyle(ButtonStyle.Primary).setEmoji('🎚'),
  );

  return { embeds: [embed], components: [row1, row2, row3] };
}

export function buildVoiceModal(type: 'limit' | 'rename' | 'trust' | 'block' | 'bitrate'): ModalBuilder {
  const configs = {
    limit: { id: 'voice:modal:limit', title: 'Nutzerlimit', label: 'Max. Nutzer (0 = unbegrenzt)', placeholder: 'z.B. 5' },
    rename: { id: 'voice:modal:rename', title: 'Channel umbenennen', label: 'Neuer Name', placeholder: 'Mein Channel' },
    trust: { id: 'voice:modal:trust', title: 'Nutzer vertrauen', label: 'User-ID', placeholder: '123456789' },
    block: { id: 'voice:modal:block', title: 'Nutzer blockieren', label: 'User-ID', placeholder: '123456789' },
    bitrate: { id: 'voice:modal:bitrate', title: 'Bitrate setzen', label: 'Bitrate in kbps (8–96)', placeholder: '64' },
  };
  const cfg = configs[type];

  return new ModalBuilder()
    .setCustomId(cfg.id)
    .setTitle(cfg.title)
    .addComponents(
      new ActionRowBuilder<TextInputBuilder>().addComponents(
        new TextInputBuilder()
          .setCustomId('value')
          .setLabel(cfg.label)
          .setStyle(TextInputStyle.Short)
          .setRequired(true)
          .setPlaceholder(cfg.placeholder),
      ),
    );
}
