import type {
  ChatInputCommandInteraction,
  Interaction,
  InteractionEditReplyOptions,
  InteractionReplyOptions,
  MessagePayload,
} from 'discord.js';
import { logger } from '../core/logger';

type ReplyPayload = string | MessagePayload | InteractionReplyOptions;
type EditPayload = string | MessagePayload | InteractionReplyOptions | InteractionEditReplyOptions;

function toReplyOptions(payload: ReplyPayload): InteractionReplyOptions {
  return typeof payload === 'string' ? { content: payload } : (payload as InteractionReplyOptions);
}

function toEditOptions(payload: EditPayload): InteractionEditReplyOptions {
  if (typeof payload === 'string') return { content: payload };
  const { ephemeral: _ephemeral, ...rest } = payload as InteractionReplyOptions;
  return rest as InteractionEditReplyOptions;
}

export async function safeReply(interaction: Interaction, payload: ReplyPayload): Promise<void> {
  if (!interaction.isRepliable()) return;

  const options = toReplyOptions(payload);
  try {
    if (interaction.replied || interaction.deferred) {
      await interaction.followUp(options);
    } else {
      await interaction.reply(options);
    }
  } catch (err) {
    logger.error(
      { err, customId: 'customId' in interaction ? interaction.customId : undefined },
      'Failed to reply to interaction',
    );
  }
}

export async function safeEditReply(
  interaction: ChatInputCommandInteraction,
  payload: EditPayload,
): Promise<void> {
  const options = toEditOptions(payload);
  try {
    if (interaction.deferred || interaction.replied) {
      await interaction.editReply(options);
    } else {
      await interaction.reply(payload as InteractionReplyOptions);
    }
  } catch (err) {
    logger.error({ err, command: interaction.commandName }, 'Failed to edit interaction reply');
  }
}

export function deferOptions(
  defer?: boolean | { ephemeral?: boolean },
): { ephemeral?: boolean } {
  if (defer === true || defer === undefined) return { ephemeral: true };
  if (defer === false) return {};
  return defer;
}

export async function deferIfNeeded(
  interaction: ChatInputCommandInteraction,
  defer?: boolean | { ephemeral?: boolean },
): Promise<void> {
  if (!defer) return;
  try {
    await interaction.deferReply(deferOptions(defer));
  } catch (err) {
    logger.error({ err, command: interaction.commandName }, 'Failed to defer interaction reply');
  }
}
