import type { Message } from 'discord.js';
import type { GuildAutoModSettings } from '@cleanqueue/shared';
import { store } from '../db/store';

const INVITE_REGEX =
  /(?:https?:\/\/)?(?:www\.)?(?:discord\.(?:gg|io|me|li)|discordapp\.com\/invite|discord\.com\/invite)\/[^\s]+/i;

export type AutoModViolation =
  | 'invite'
  | 'spam'
  | 'mentions'
  | 'caps'
  | 'repeated';

export interface AutoModResult {
  violation: AutoModViolation;
  reason: string;
}

export function checkAutomod(message: Message, settings: GuildAutoModSettings): AutoModResult | null {
  if (!message.guild || message.author.bot) return null;

  const content = message.content ?? '';
  const guildId = message.guild.id;
  const userId = message.author.id;

  if (settings.blockInvites !== false && INVITE_REGEX.test(content)) {
    return { violation: 'invite', reason: 'Discord-Einladungslinks sind nicht erlaubt.' };
  }

  const mentionCount = message.mentions.users.size + message.mentions.roles.size;
  const maxMentions = settings.maxMentions ?? 5;
  if (mentionCount > maxMentions) {
    return {
      violation: 'mentions',
      reason: `Zu viele Erwähnungen (${mentionCount}/${maxMentions}).`,
    };
  }

  const spamWindow = settings.spamWindowMs ?? 5000;
  const spamCount = store.trackSpamMessage(guildId, userId, spamWindow);
  const spamThreshold = settings.spamThreshold ?? 5;
  if (spamCount >= spamThreshold) {
    return {
      violation: 'spam',
      reason: `Nachrichten-Flut (${spamCount} in ${spamWindow / 1000}s).`,
    };
  }

  const minLen = settings.capsMinLength ?? 12;
  const capsThreshold = settings.capsThreshold ?? 70;
  if (content.length >= minLen) {
    const letters = content.replace(/[^a-zA-ZäöüÄÖÜß]/g, '');
    if (letters.length >= minLen) {
      const upper = letters.replace(/[^A-ZÄÖÜ]/g, '').length;
      const pct = (upper / letters.length) * 100;
      if (pct >= capsThreshold) {
        return { violation: 'caps', reason: `Zu viele Großbuchstaben (${Math.round(pct)}%).` };
      }
    }
  }

  const repeatWindow = settings.repeatedTextWindowMs ?? 60_000;
  const repeatCount = settings.repeatedTextCount ?? 3;
  if (content.trim().length >= 4) {
    const repeats = store.trackRepeatedMessage(guildId, userId, content, repeatWindow);
    if (repeats >= repeatCount) {
      return {
        violation: 'repeated',
        reason: `Wiederholter Text (${repeats}× identisch).`,
      };
    }
  }

  return null;
}

export function violationLabel(v: AutoModViolation): string {
  const labels: Record<AutoModViolation, string> = {
    invite: 'Einladungslink',
    spam: 'Spam-Flut',
    mentions: 'Massen-Mention',
    caps: 'CAPS-Lock',
    repeated: 'Wiederholter Text',
  };
  return labels[v];
}
