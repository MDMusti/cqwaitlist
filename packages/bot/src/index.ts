import 'dotenv/config';
import { CleanQueueClient } from './core/Client';
import { ModuleRegistry } from './core/ModuleRegistry';
import { logger } from './core/logger';
import { config } from './config';
import { createCoreModule, createInteractionCreateEvent } from './modules/core';
import { moderationModule } from './modules/moderation';
import { verificationModule } from './modules/verification';
import { voiceModule } from './modules/voice';
import { communityModule } from './modules/community';
import { ticketsModule } from './modules/tickets';
import { loggingModule } from './modules/logging';
import { gamesModule } from './modules/games';

async function main(): Promise<void> {
  const registry = new ModuleRegistry();

  registry.register(createCoreModule(registry));
  registry.register(moderationModule);
  registry.register(verificationModule);
  registry.register(voiceModule);
  registry.register(communityModule);
  registry.register(ticketsModule);
  registry.register(loggingModule);
  registry.register(gamesModule);

  const client = new CleanQueueClient(registry);
  registry.bootstrap(client);
  client.registerEvent(createInteractionCreateEvent(registry));

  client.on('error', (err) => logger.error({ err }, 'Discord client error'));

  await client.login(config.BOT_TOKEN);
}

main().catch((err) => {
  logger.fatal({ err }, 'Bot failed to start');
  process.exit(1);
});
