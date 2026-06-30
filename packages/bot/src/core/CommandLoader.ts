import type { BotCommand } from '@cleanqueue/shared';
import type { CleanQueueClient } from './Client';
import { logger } from './logger';

export class CommandLoader {
  load(client: CleanQueueClient, commands: BotCommand[]): void {
    for (const command of commands) {
      client.registerCommand(command);
      logger.debug({ command: command.name, module: command.moduleId }, 'Command loaded');
    }
  }
}
