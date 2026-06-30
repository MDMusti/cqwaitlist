import type { BotModule } from '@cleanqueue/shared';
import type { ModuleRegistry } from '../../core/ModuleRegistry';
import type { CleanQueueClient } from '../../core/Client';
import { logger } from '../../core/logger';
import { config } from '../../config';
import { deferIfNeeded, safeReply } from '../../lib/interactions';
import { createStatusCommand } from './status.command';
import { createSetupCommand } from './setup.command';

export function createCoreModule(registry: ModuleRegistry): BotModule {
  return {
    id: 'core',
    label: 'Core',
    phase: 1,
    enabled: true,
    description: 'Framework, slash command registration, /setup, system status',
    commands: [createStatusCommand(registry), createSetupCommand()],
    events: [createReadyEvent(registry)],
  };
}

function createReadyEvent(registry: ModuleRegistry): import('@cleanqueue/shared').BotEvent {
  return {
    name: 'clientReady',
    once: true,
    async execute(client) {
      const cqClient = client as CleanQueueClient;
      const commandNames = [...cqClient.commands.keys()];

      logger.info(
        {
          user: client.user?.tag,
          userId: client.user?.id,
          guildId: config.GUILD_ID ?? 'global',
          commandCount: cqClient.commands.size,
          commands: commandNames,
          moduleCount: registry.list().length,
          nodeEnv: config.NODE_ENV ?? process.env.NODE_ENV,
        },
        'Bot ready — health check OK',
      );

      if (!config.GUILD_ID) {
        logger.warn('GUILD_ID not set — slash commands registered globally (up to 1h propagation)');
      }

      try {
        await cqClient.registerSlashCommands();
      } catch (err) {
        logger.error({ err }, 'Failed to register slash commands');
      }
    },
  };
}

export function createInteractionCreateEvent(registry: ModuleRegistry): import('@cleanqueue/shared').BotEvent {
  return {
    name: 'interactionCreate',
    async execute(interaction) {
      try {
        if (interaction.isChatInputCommand()) {
          const client = interaction.client as CleanQueueClient;
          const command = client.commands.get(interaction.commandName);

          if (!command) {
            logger.warn({ command: interaction.commandName }, 'Unknown slash command');
            await safeReply(interaction, {
              content: 'Unbekannter Befehl — bitte `/cleanqueue status` prüfen oder Bot neu starten.',
              ephemeral: true,
            });
            return;
          }

          await deferIfNeeded(interaction, command.deferReply);

          try {
            await command.execute(interaction);
          } catch (err) {
            logger.error({ err, command: interaction.commandName }, 'Command execution failed');
            await safeReply(interaction, {
              content: 'Ein Fehler ist aufgetreten.',
              ephemeral: true,
            });
          }
          return;
        }

        if (
          interaction.isButton() ||
          interaction.isModalSubmit() ||
          interaction.isStringSelectMenu()
        ) {
          for (const handler of registry.getComponentHandlers()) {
            try {
              const handled = await handler(interaction);
              if (handled) return;
            } catch (err) {
              logger.error({ err, customId: interaction.customId }, 'Component handler failed');
              await safeReply(interaction, {
                content: 'Ein Fehler ist aufgetreten.',
                ephemeral: true,
              });
              return;
            }
          }
        }
      } catch (err) {
        logger.error({ err }, 'interactionCreate handler failed');
        if (interaction.isRepliable()) {
          await safeReply(interaction, {
            content: 'Ein Fehler ist aufgetreten.',
            ephemeral: true,
          });
        }
      }
    },
  };
}
