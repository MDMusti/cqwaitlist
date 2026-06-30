import type { BotEvent, BotModule } from '@cleanqueue/shared';
import type { CleanQueueClient } from '../../core/Client';
import type { ModuleRegistry } from '../../core/ModuleRegistry';
import { logger } from '../../core/logger';
import { createStatusCommand } from './status.command';

export function createCoreModule(registry: ModuleRegistry): BotModule {
  return {
    id: 'core',
    label: 'Core',
    phase: 1,
    enabled: true,
    description: 'Framework, slash command registration, system status',
    commands: [createStatusCommand(registry)],
    events: [createReadyEvent()],
  };
}

function createReadyEvent(): BotEvent<'ready'> {
  return {
    name: 'ready',
    once: true,
    async execute(client) {
      const cqClient = client as CleanQueueClient;
      logger.info({ user: client.user?.tag }, 'Bot ready');

      try {
        await cqClient.registerSlashCommands();
      } catch (err) {
        logger.error({ err }, 'Failed to register slash commands');
      }
    },
  };
}

export function createInteractionCreateEvent(): BotEvent<'interactionCreate'> {
  return {
    name: 'interactionCreate',
    async execute(interaction) {
      if (!interaction.isChatInputCommand()) return;

      const client = interaction.client as CleanQueueClient;
      const command = client.commands.get(interaction.commandName);
      if (!command) return;

      try {
        await command.execute(interaction);
      } catch (err) {
        logger.error({ err, command: interaction.commandName }, 'Command execution failed');
        const payload = { content: 'Ein Fehler ist aufgetreten.', ephemeral: true };
        if (interaction.replied || interaction.deferred) {
          await interaction.followUp(payload);
        } else {
          await interaction.reply(payload);
        }
      }
    },
  };
}
