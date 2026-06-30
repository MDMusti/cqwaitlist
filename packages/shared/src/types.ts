import type {
  ChatInputCommandInteraction,
  ClientEvents,
  SlashCommandBuilder,
  SlashCommandOptionsOnlyBuilder,
  SlashCommandSubcommandsOnlyBuilder,
} from 'discord.js';

export type SlashCommandData =
  | SlashCommandBuilder
  | SlashCommandOptionsOnlyBuilder
  | SlashCommandSubcommandsOnlyBuilder
  | Omit<SlashCommandBuilder, 'addSubcommand' | 'addSubcommandGroup'>;

export interface BotCommand {
  /** Unique command name (matches SlashCommandBuilder name). */
  name: string;
  data: SlashCommandData;
  /** Optional module id for status reporting. */
  moduleId?: string;
  execute(interaction: ChatInputCommandInteraction): Promise<void>;
}

export type BotEvent<K extends keyof ClientEvents = keyof ClientEvents> = {
  name: K;
  once?: boolean;
  execute(...args: ClientEvents[K]): Promise<void> | void;
};

export interface BotModule {
  /** Stable module identifier, e.g. "moderation". */
  id: string;
  /** Human-readable label for /cleanqueue status. */
  label: string;
  /** Phase 1 = placeholder; Phase 2+ = active implementation. */
  phase: number;
  enabled: boolean;
  description?: string;
  commands?: BotCommand[];
  events?: BotEvent[];
}

export const APP_NAME = 'CleanQueue';
export const APP_VERSION = '2.0.0-phase1';
