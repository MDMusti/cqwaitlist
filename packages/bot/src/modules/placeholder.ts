import type { BotModule } from '@cleanqueue/shared';

export function createPlaceholderModule(
  id: string,
  label: string,
  description: string,
): BotModule {
  return {
    id,
    label,
    phase: 2,
    enabled: false,
    description,
  };
}
