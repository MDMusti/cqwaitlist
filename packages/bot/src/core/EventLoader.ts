import type { BotEvent } from '@cleanqueue/shared';
import type { CleanQueueClient } from './Client';
import { logger } from './logger';

export class EventLoader {
  load(client: CleanQueueClient, events: BotEvent[]): void {
    for (const event of events) {
      client.registerEvent(event);
      logger.debug({ event: event.name, once: event.once ?? false }, 'Event loaded');
    }
  }
}
