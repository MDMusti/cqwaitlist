import { SlashCommandBuilder } from 'discord.js';
import type { BotCommand, BotModule } from '@cleanqueue/shared';
import { APP_NAME, APP_VERSION } from '@cleanqueue/shared';
import type { ModuleRegistry } from '../../core/ModuleRegistry';
import type { CleanQueueClient } from '../../core/Client';
import { config } from '../../config';
import { store } from '../../db/store';
import { xpToNextLevel } from '../../lib/levels';
import { helpEmbed, modulesEmbed, profileEmbed, statusEmbed } from '../../lib/ui';
import { safeEditReply } from '../../lib/interactions';

function formatUptime(): string {
  const uptime = process.uptime();
  const hours = Math.floor(uptime / 3600);
  const minutes = Math.floor((uptime % 3600) / 60);
  const seconds = Math.floor(uptime % 60);
  return `${hours}h ${minutes}m ${seconds}s`;
}

function formatModuleSummary(modules: BotModule[]): string {
  return modules
    .map((m) => {
      const status = m.enabled ? '✅ aktiv' : `⏳ Phase ${m.phase}`;
      return `**${m.label}** (\`${m.id}\`) — ${status}`;
    })
    .join('\n');
}

export function createStatusCommand(registry: ModuleRegistry): BotCommand {
  return {
    name: 'cleanqueue',
    moduleId: 'core',
    deferReply: { ephemeral: true },
    data: new SlashCommandBuilder()
      .setName('cleanqueue')
      .setDescription(`${APP_NAME} — Command Hub & System`)
      .addSubcommand((sub) =>
        sub.setName('help').setDescription('Alle Befehle und Module im Überblick'),
      )
      .addSubcommand((sub) =>
        sub.setName('modules').setDescription('Modul-Status mit Phase-Badges'),
      )
      .addSubcommand((sub) =>
        sub
          .setName('profile')
          .setDescription('Profil mit XP, Level, Strikes & Fortschritt')
          .addUserOption((o) =>
            o.setName('user').setDescription('Anderes Mitglied anzeigen').setRequired(false),
          ),
      )
      .addSubcommand((sub) =>
        sub.setName('status').setDescription('System-Info, Uptime & Infrastruktur'),
      ),
    async execute(interaction) {
      const sub = interaction.options.getSubcommand();

      if (sub === 'help') {
        const client = interaction.client as CleanQueueClient;
        const commands = [...client.commands.values()].map((cmd) => ({
          name: cmd.name,
          description:
            'data' in cmd && 'description' in cmd.data
              ? String((cmd.data as { description?: string }).description ?? '—')
              : '—',
          module: cmd.moduleId ?? 'core',
        }));

        await safeEditReply(interaction, {
          embeds: [helpEmbed(commands.sort((a, b) => a.name.localeCompare(b.name)))],
        });
        return;
      }

      if (sub === 'modules') {
        const modules = registry.list();
        await safeEditReply(interaction, { embeds: [modulesEmbed(modules)] });
        return;
      }

      if (sub === 'profile') {
        if (!interaction.guild) {
          await safeEditReply(interaction, { content: 'Nur auf Servern verfügbar.', ephemeral: true });
          return;
        }

        const target = interaction.options.getUser('user') ?? interaction.user;
        const record = store.getOrCreateMember(interaction.guild.id, target.id);
        const toNext = xpToNextLevel(record.xp, record.level);
        const targetTotal = record.xp + toNext;

        await safeEditReply(interaction, {
          embeds: [
            profileEmbed({
              username: target.username,
              avatarUrl: target.displayAvatarURL({ size: 128 }),
              level: record.level,
              xp: record.xp,
              xpToNext: toNext,
              streak: record.streakDays,
              strikes: record.strikes,
              verified: record.verified,
              progressPct: targetTotal > 0 ? (record.xp / targetTotal) * 100 : 100,
            }),
          ],
        });
        return;
      }

      if (sub === 'status') {
        const modules = registry.list();
        await safeEditReply(interaction, {
          embeds: [
            statusEmbed({
              version: APP_VERSION,
              uptime: formatUptime(),
              guildScope: config.GUILD_ID ? `\`${config.GUILD_ID}\`` : '`global`',
              database: config.DATABASE_URL ? '✅ konfiguriert' : '⚠️ JSON-Fallback',
              redis: config.REDIS_URL ? '✅ konfiguriert' : '⚠️ nicht konfiguriert',
              moduleSummary: formatModuleSummary(modules),
            }),
          ],
        });
        return;
      }

      await safeEditReply(interaction, { content: 'Unbekannter Subcommand.', ephemeral: true });
    },
  };
}
