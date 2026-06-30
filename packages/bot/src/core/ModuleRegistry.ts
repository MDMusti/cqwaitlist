import type { BotModule } from '@cleanqueue/shared';
import { CommandLoader } from './CommandLoader';
import type { CleanQueueClient } from './Client';
import { EventLoader } from './EventLoader';
import { logger } from './logger';

export class ModuleRegistry {
  private readonly modules = new Map<string, BotModule>();
  private readonly commandLoader = new CommandLoader();
  private readonly eventLoader = new EventLoader();

  register(module: BotModule): void {
    if (this.modules.has(module.id)) {
      throw new Error(`Module "${module.id}" is already registered`);
    }
    this.modules.set(module.id, module);
    logger.info({ module: module.id, phase: module.phase, enabled: module.enabled }, 'Module registered');
  }

  bootstrap(client: CleanQueueClient): void {
    const allCommands = [];
    const allEvents = [];

    for (const module of this.modules.values()) {
      if (!module.enabled) {
        logger.debug({ module: module.id }, 'Module disabled — skipping bootstrap');
        continue;
      }
      if (module.commands?.length) allCommands.push(...module.commands);
      if (module.events?.length) allEvents.push(...module.events);
    }

    this.commandLoader.load(client, allCommands);
    this.eventLoader.load(client, allEvents);
  }

  list(): BotModule[] {
    return [...this.modules.values()];
  }

  get(id: string): BotModule | undefined {
    return this.modules.get(id);
  }
}
