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
  /** Defer reply before execute to avoid Discord's 3s interaction timeout. */
  deferReply?: boolean | { ephemeral?: boolean };
  execute(interaction: ChatInputCommandInteraction): Promise<void>;
}

export interface BotEvent {
  name: keyof ClientEvents;
  once?: boolean;
  execute: (...args: any[]) => Promise<void> | void;
}

export type ComponentHandler = (
  interaction: import('discord.js').Interaction,
) => Promise<boolean>;

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
  /** Handle button/modal/select interactions; return true if handled. */
  componentHandlers?: ComponentHandler[];
}

export const APP_NAME = 'CleanQueue';
export const APP_VERSION = '2.0.0';
export const BRAND_COLOR = 0x7c5cfc;

/** Per-guild channel and role IDs stored by /setup. */
export interface GuildChannels {
  verify?: string;
  rules?: string;
  rulesDetailed?: string;
  welcome?: string;
  general?: string;
  tickets?: string;
  ticketCategory?: string;
  suggestions?: string;
  roles?: string;
  logs?: string;
  modLogs?: string;
  createVoice?: string;
  voiceCategory?: string;
  voiceControl?: string;
  events?: string;
  botCommands?: string;
  levelUp?: string;
  modOnly?: string;
  partner?: string;
  automodNotice?: string;
}

export interface GuildAutoModSettings {
  blockInvites?: boolean;
  maxMentions?: number;
  spamThreshold?: number;
  spamWindowMs?: number;
  capsThreshold?: number;
  capsMinLength?: number;
  repeatedTextCount?: number;
  repeatedTextWindowMs?: number;
  quarantineOnViolation?: boolean;
}

export interface GuildRoles {
  verified18?: string;
  member?: string;
  moderator?: string;
  muted?: string;
  quarantine?: string;
  level5?: string;
  level10?: string;
  level25?: string;
  gamer?: string;
  artist?: string;
  developer?: string;
  streamer?: string;
}

export interface GuildWelcomeSettings {
  leaveMessageEnabled?: boolean;
  leaveMessage?: string;
}

export interface GuildModuleSettings {
  channels: GuildChannels;
  roles: GuildRoles;
  verification?: { minAccountAgeDays: number };
  automod?: GuildAutoModSettings;
  welcome?: GuildWelcomeSettings;
  antiRaid?: { joinThreshold: number; windowMs: number };
}
