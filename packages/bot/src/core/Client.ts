import {
  Client,
  Collection,
  GatewayIntentBits,
  Partials,
  REST,
  Routes,
} from 'discord.js';
import type { BotCommand, BotEvent } from '@cleanqueue/shared';
import { config } from '../config';
import { logger } from './logger';
import type { ModuleRegistry } from './ModuleRegistry';

export class CleanQueueClient extends Client {
  readonly commands = new Collection<string, BotCommand>();

  constructor(private readonly registry: ModuleRegistry) {
    super({
      intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildVoiceStates,
        GatewayIntentBits.GuildModeration,
      ],
      partials: [Partials.Channel, Partials.GuildMember, Partials.Message],
    });
  }

  registerCommand(command: BotCommand): void {
    if (this.commands.has(command.name)) {
      logger.warn({ command: command.name }, 'Overwriting existing command');
    }
    this.commands.set(command.name, command);
  }

  registerEvent(event: BotEvent): void {
    const handler = (...args: unknown[]) => {
      void Promise.resolve(event.execute(...(args as Parameters<typeof event.execute>))).catch(
        (err: unknown) => {
          logger.error({ err, event: event.name }, 'Event handler failed');
        },
      );
    };

    if (event.once) {
      this.once(event.name, handler);
    } else {
      this.on(event.name, handler);
    }
  }

  async registerSlashCommands(): Promise<void> {
    const payload = [...this.commands.values()].map((cmd) => cmd.data.toJSON());
    const rest = new REST({ version: '10' }).setToken(config.BOT_TOKEN);

    if (config.GUILD_ID) {
      await rest.put(Routes.applicationGuildCommands(config.CLIENT_ID, config.GUILD_ID), {
        body: payload,
      });
      logger.info({ guildId: config.GUILD_ID, count: payload.length }, 'Guild slash commands registered');
    } else {
      await rest.put(Routes.applicationCommands(config.CLIENT_ID), { body: payload });
      logger.info({ count: payload.length }, 'Global slash commands registered');
    }
  }

  get registryRef(): ModuleRegistry {
    return this.registry;
  }
}
