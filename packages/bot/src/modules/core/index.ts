import type { BotModule } from '@cleanqueue/shared';
import type { ModuleRegistry } from '../../core/ModuleRegistry';
import type { CleanQueueClient } from '../../core/Client';
import { logger } from '../../core/logger';
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
    events: [createReadyEvent()],
  };
}

function createReadyEvent(): import('@cleanqueue/shared').BotEvent {
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

export function createInteractionCreateEvent(registry: ModuleRegistry): import('@cleanqueue/shared').BotEvent {
  return {
    name: 'interactionCreate',
    async execute(interaction) {
      if (interaction.isChatInputCommand()) {
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
            const payload = { content: 'Ein Fehler ist aufgetreten.', ephemeral: true };
            if (interaction.replied || interaction.deferred) {
              await interaction.followUp(payload).catch(() => undefined);
            } else {
              await interaction.reply(payload).catch(() => undefined);
            }
            return;
          }
        }
      }
    },
  };
}
