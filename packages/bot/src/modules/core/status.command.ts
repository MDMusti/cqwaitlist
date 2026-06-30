import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';
import type { BotCommand, BotModule } from '@cleanqueue/shared';
import { APP_NAME, APP_VERSION } from '@cleanqueue/shared';
import type { ModuleRegistry } from '../../core/ModuleRegistry';
import { config } from '../../config';

function formatModuleStatus(modules: BotModule[]): string {
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
    data: new SlashCommandBuilder()
      .setName('cleanqueue')
      .setDescription(`${APP_NAME} system commands`)
      .addSubcommand((sub) =>
        sub.setName('status').setDescription('System info and module status'),
      ),
    async execute(interaction) {
      if (interaction.options.getSubcommand() !== 'status') return;

      const modules = registry.list();
      const uptime = process.uptime();
      const hours = Math.floor(uptime / 3600);
      const minutes = Math.floor((uptime % 3600) / 60);
      const seconds = Math.floor(uptime % 60);

      const embed = new EmbedBuilder()
        .setColor(0x7c5cfc)
        .setTitle(`${APP_NAME} — System Status`)
        .setDescription('Enterprise modular Discord platform — alle Phasen aktiv')
        .addFields(
          { name: 'Version', value: `\`${APP_VERSION}\``, inline: true },
          { name: 'Node.js', value: `\`${process.version}\``, inline: true },
          {
            name: 'Uptime',
            value: `\`${hours}h ${minutes}m ${seconds}s\``,
            inline: true,
          },
          {
            name: 'Guild scope',
            value: config.GUILD_ID ? `\`${config.GUILD_ID}\`` : '`global`',
            inline: true,
          },
          {
            name: 'Database',
            value: config.DATABASE_URL ? '✅ configured' : '⚠️ not configured',
            inline: true,
          },
          {
            name: 'Redis',
            value: config.REDIS_URL ? '✅ configured' : '⚠️ not configured',
            inline: true,
          },
          { name: 'Modules', value: formatModuleStatus(modules) },
        )
        .setFooter({ text: 'CleanQueue · /cleanqueue status' })
        .setTimestamp();

      await interaction.reply({ embeds: [embed], ephemeral: true });
    },
  };
}
