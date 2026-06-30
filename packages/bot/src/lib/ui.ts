import { EmbedBuilder, type APIEmbedField, type ColorResolvable } from 'discord.js';
import { APP_NAME, BRAND_COLOR } from '@cleanqueue/shared';

/** CleanQueue Farbpalette — konsistent über alle Module. */
export const COLORS = {
  primary: BRAND_COLOR,
  success: 0x57f287,
  warning: 0xfee75c,
  danger: 0xed4245,
  info: 0x5865f2,
  muted: 0x747f8d,
} as const;

/** Emoji-Konstanten für einheitliche UI-Sprache. */
export const EMOJI = {
  brand: '✨',
  success: '✅',
  error: '❌',
  warning: '⚠️',
  info: 'ℹ️',
  verify: '🔐',
  ticket: '🎫',
  mod: '🛡️',
  level: '⭐',
  voice: '🔊',
  game: '🎮',
  rules: '📜',
  welcome: '👋',
  partner: '🤝',
  lock: '🔒',
  unlock: '🔓',
  claim: '🙋',
  daily: '🎁',
} as const;

const FOOTER = `${APP_NAME} · Enterprise Discord Platform`;

function base(color: ColorResolvable = COLORS.primary): EmbedBuilder {
  return new EmbedBuilder().setColor(color).setFooter({ text: FOOTER }).setTimestamp();
}

export function primaryEmbed(title?: string, description?: string): EmbedBuilder {
  const embed = base(COLORS.primary);
  if (title) embed.setTitle(`${EMOJI.brand} ${title}`);
  if (description) embed.setDescription(description);
  return embed;
}

export function successEmbed(message: string, title = 'Erfolg'): EmbedBuilder {
  return base(COLORS.success)
    .setTitle(`${EMOJI.success} ${title}`)
    .setDescription(message);
}

export function errorEmbed(message: string, title = 'Fehler'): EmbedBuilder {
  return base(COLORS.danger)
    .setTitle(`${EMOJI.error} ${title}`)
    .setDescription(message);
}

export function warningEmbed(message: string, title = 'Hinweis'): EmbedBuilder {
  return base(COLORS.warning)
    .setTitle(`${EMOJI.warning} ${title}`)
    .setDescription(message);
}

export function infoEmbed(message: string, title?: string): EmbedBuilder {
  const embed = base(COLORS.info);
  if (title) embed.setTitle(`${EMOJI.info} ${title}`);
  embed.setDescription(message);
  return embed;
}

export function modCaseEmbed(opts: {
  caseNumber: number;
  type: string;
  targetTag: string;
  moderatorTag: string;
  reason: string;
  strikes?: string;
}): EmbedBuilder {
  const embed = base(COLORS.danger)
    .setTitle(`${EMOJI.mod} Case #${opts.caseNumber} — ${opts.type.toUpperCase()}`)
    .addFields(
      { name: 'Nutzer', value: opts.targetTag, inline: true },
      { name: 'Moderator', value: opts.moderatorTag, inline: true },
      { name: 'Grund', value: opts.reason || 'Kein Grund angegeben' },
    );
  if (opts.strikes) {
    embed.addFields({ name: 'Strikes', value: opts.strikes, inline: true });
  }
  return embed;
}

export function welcomeEmbed(opts: {
  memberMention: string;
  verifyChannelId?: string;
}): EmbedBuilder {
  const verifyHint = opts.verifyChannelId
    ? `Verifiziere dich zuerst in <#${opts.verifyChannelId}> — dort findest du alle Schritte.`
    : 'Verifiziere dich im Verify-Channel, um Zugang zu erhalten.';

  return base(COLORS.primary)
    .setTitle(`${EMOJI.welcome} Willkommen bei ${APP_NAME}`)
    .setDescription(
      `Hey ${opts.memberMention}, schön dass du da bist!\n\n` +
        `${verifyHint}\n\n` +
        `Wir legen Wert auf **Respekt**, **Sicherheit** und eine **women-friendly** Community.`,
    )
    .setThumbnail('https://cdn.discordapp.com/embed/avatars/0.png');
}

export function levelUpEmbed(opts: {
  username: string;
  level: number;
  xp: number;
}): EmbedBuilder {
  return base(COLORS.success)
    .setTitle(`${EMOJI.level} Level-Up!`)
    .setDescription(
      `**${opts.username}** ist jetzt **Level ${opts.level}**!\n\n` +
        `Gesamt-XP: **${opts.xp.toLocaleString('de-DE')}** — weiter so!`,
    );
}

export function profileEmbed(opts: {
  username: string;
  avatarUrl?: string;
  level: number;
  xp: number;
  xpToNext: number;
  streak: number;
  strikes: number;
  verified: boolean;
  progressPct: number;
}): EmbedBuilder {
  const bar = progressBar(opts.xp, opts.xp + opts.xpToNext);
  const embed = base(COLORS.primary)
    .setTitle(`${EMOJI.level} Profil — ${opts.username}`)
    .setDescription(`Fortschritt zum nächsten Level:\n${bar}`)
    .addFields(
      { name: 'Level', value: `**${opts.level}**`, inline: true },
      { name: 'XP', value: `**${opts.xp.toLocaleString('de-DE')}**`, inline: true },
      { name: 'Bis Level-Up', value: `**${opts.xpToNext}** XP`, inline: true },
      { name: 'Daily-Streak', value: `**${opts.streak}** Tag(e)`, inline: true },
      { name: 'Strikes', value: `**${opts.strikes}** / 3`, inline: true },
      {
        name: 'Verifiziert',
        value: opts.verified ? `${EMOJI.success} Ja` : `${EMOJI.warning} Nein`,
        inline: true,
      },
    );
  if (opts.avatarUrl) embed.setThumbnail(opts.avatarUrl);
  return embed;
}

export function rulesEmbed(): EmbedBuilder {
  return base(COLORS.primary)
    .setTitle(`${EMOJI.rules} Server-Regeln`)
    .setDescription(
      'Unsere Community lebt von **Respekt**, **Sicherheit** und **Transparenz**. ' +
        'Bitte halte dich an folgende Grundsätze:',
    )
    .addFields(
      {
        name: '1 · Respekt & Sicherheit',
        value:
          'Kein Hass, keine Belästigung, keine Diskriminierung. ' +
          'Wir schützen besonders vulnerable Gruppen — **zero tolerance** für Grenzüberschreitungen.',
      },
      {
        name: '2 · Altersnachweis',
        value: 'Dieser Server ist **18+**. Verifizierung ist Pflicht für vollen Zugang.',
      },
      {
        name: '3 · Kein Spam & Werbung',
        value:
          'Keine unerlaubten Invites, Massen-Mentions oder wiederholtes Spam-Verhalten. ' +
          'AutoMod greift automatisch ein.',
      },
      {
        name: '4 · Moderation',
        value:
          'Moderatoren haben das letzte Wort. Bei Verstößen: Verwarnung → Strike → Mute. ' +
          'Tickets und Appeals sind jederzeit möglich.',
      },
      {
        name: '5 · Privatsphäre',
        value: 'Keine Doxxing, keine Weitergabe privater Daten — auch nicht „als Scherz".',
      },
    );
}

export function helpEmbed(commands: { name: string; description: string; module: string }[]): EmbedBuilder {
  const grouped = new Map<string, string[]>();
  for (const cmd of commands) {
    const list = grouped.get(cmd.module) ?? [];
    list.push(`\`/${cmd.name}\` — ${cmd.description}`);
    grouped.set(cmd.module, list);
  }

  const fields: APIEmbedField[] = [...grouped.entries()].map(([module, cmds]) => ({
    name: module,
    value: cmds.join('\n'),
  }));

  return base(COLORS.primary)
    .setTitle(`${EMOJI.brand} CleanQueue — Befehlsübersicht`)
    .setDescription(
      'Premium Discord-Plattform mit Verifizierung, Tickets, Moderation, Community & Games.\n\n' +
        '**Hub:** `/cleanqueue help` · `/cleanqueue modules` · `/cleanqueue profile` · `/cleanqueue status`',
    )
    .addFields(fields.slice(0, 25));
}

export function modulesEmbed(
  modules: { id: string; label: string; phase: number; enabled: boolean; description?: string }[],
): EmbedBuilder {
  const lines = modules.map((m) => {
    const badge = m.enabled ? `${EMOJI.success} Phase ${m.phase}` : `${EMOJI.warning} Phase ${m.phase}`;
    const desc = m.description ? `\n↳ ${m.description}` : '';
    return `**${m.label}** (\`${m.id}\`) — ${badge}${desc}`;
  });

  return base(COLORS.info)
    .setTitle(`${EMOJI.info} Modul-Status`)
    .setDescription(lines.join('\n\n'));
}

export function statusEmbed(opts: {
  version: string;
  uptime: string;
  guildScope: string;
  database: string;
  redis: string;
  moduleSummary: string;
}): EmbedBuilder {
  return base(COLORS.primary)
    .setTitle(`${EMOJI.brand} CleanQueue — System Status`)
    .setDescription('Enterprise modular Discord Platform — Premium Upgrade Pass aktiv')
    .addFields(
      { name: 'Version', value: `\`${opts.version}\``, inline: true },
      { name: 'Node.js', value: `\`${process.version}\``, inline: true },
      { name: 'Uptime', value: `\`${opts.uptime}\``, inline: true },
      { name: 'Guild Scope', value: opts.guildScope, inline: true },
      { name: 'Datenbank', value: opts.database, inline: true },
      { name: 'Redis', value: opts.redis, inline: true },
      { name: 'Module', value: opts.moduleSummary },
    );
}

export function progressBar(current: number, target: number, length = 14): string {
  if (target <= 0) return `${'█'.repeat(length)} 100%`;
  const pct = Math.min(1, Math.max(0, current / target));
  const filled = Math.round(pct * length);
  const empty = length - filled;
  return `\`[${'█'.repeat(filled)}${'░'.repeat(empty)}]\` ${Math.round(pct * 100)}%`;
}

/** @deprecated Use primaryEmbed — kept for gradual migration */
export function brandEmbed(title?: string): EmbedBuilder {
  return primaryEmbed(title);
}
