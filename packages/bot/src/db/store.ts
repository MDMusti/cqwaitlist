import fs from 'fs';
import path from 'path';
import type { GuildModuleSettings } from '@cleanqueue/shared';
import { config } from '../config';
import { logger } from '../core/logger';

export interface MemberRecord {
  guildId: string;
  userId: string;
  joinedAt: string;
  verified: boolean;
  verifiedAt?: string;
  xp: number;
  level: number;
  strikes: number;
  streakDays: number;
  lastDaily?: string;
  lastXpAt?: string;
}

export interface CaseRecord {
  id: string;
  guildId: string;
  caseNumber: number;
  targetId: string;
  moderatorId?: string;
  type: string;
  reason?: string;
  status: string;
  duration?: number;
  expiresAt?: string;
  createdAt: string;
}

export interface AuditLogRecord {
  id: string;
  guildId: string;
  actorId?: string;
  action: string;
  targetId?: string;
  metadata?: Record<string, unknown>;
  createdAt: string;
}

export interface TicketRecord {
  id: string;
  guildId: string;
  channelId: string;
  userId: string;
  department: string;
  subject?: string;
  description?: string;
  claimedBy?: string;
  status: string;
  createdAt: string;
  closedAt?: string;
}

export interface GuildConfigRecord {
  id: string;
  name?: string;
  locale: string;
  config: GuildModuleSettings;
  createdAt: string;
  updatedAt: string;
}

interface TempVoiceRecord {
  ownerId: string;
  channelId: string;
  panelChannelId?: string;
  panelMessageId?: string;
  trusted?: string[];
  blocked?: string[];
  userLimit?: number;
  hidden?: boolean;
}

interface StoreData {
  guildConfigs: Record<string, GuildConfigRecord>;
  members: Record<string, MemberRecord>;
  cases: CaseRecord[];
  auditLogs: AuditLogRecord[];
  tickets: TicketRecord[];
  caseCounters: Record<string, number>;
  captchas: Record<string, { answer: number; expiresAt: number }>;
  tempVoice: Record<string, TempVoiceRecord>;
  spamTracker: Record<string, { timestamps: number[] }>;
  messageTracker: Record<string, { contents: { text: string; at: number }[] }>;
  joinTracker: Record<string, { timestamps: number[] }>;
  giveaways: Record<string, GiveawayRecord>;
  verifyAccepted: Record<string, number>;
}

export interface GiveawayRecord {
  id: string;
  guildId: string;
  channelId: string;
  messageId: string;
  prize: string;
  hostId: string;
  winnerCount: number;
  endsAt: number;
  entrants: string[];
}

const DEFAULT_SETTINGS: GuildModuleSettings = {
  channels: {},
  roles: {},
  verification: { minAccountAgeDays: 7 },
  automod: {
    blockInvites: true,
    maxMentions: 5,
    spamThreshold: 5,
    spamWindowMs: 5000,
    capsThreshold: 70,
    capsMinLength: 12,
    repeatedTextCount: 3,
    repeatedTextWindowMs: 60_000,
    quarantineOnViolation: false,
  },
  welcome: { leaveMessageEnabled: true },
  antiRaid: { joinThreshold: 5, windowMs: 10_000 },
};

const DATA_DIR = path.join(process.cwd(), 'data');
const STORE_FILE = path.join(DATA_DIR, 'cleanqueue-store.json');

function memberKey(guildId: string, userId: string): string {
  return `${guildId}:${userId}`;
}

function emptyStore(): StoreData {
  return {
    guildConfigs: {},
    members: {},
    cases: [],
    auditLogs: [],
    tickets: [],
    caseCounters: {},
    captchas: {},
    tempVoice: {},
    spamTracker: {},
    messageTracker: {},
    joinTracker: {},
    giveaways: {},
    verifyAccepted: {},
  };
}

function loadFromDisk(): StoreData {
  try {
    if (fs.existsSync(STORE_FILE)) {
      const raw = fs.readFileSync(STORE_FILE, 'utf8');
      return { ...emptyStore(), ...JSON.parse(raw) };
    }
  } catch (err) {
    logger.warn({ err }, 'Failed to load JSON store — starting fresh');
  }
  return emptyStore();
}

function saveToDisk(data: StoreData): void {
  try {
    if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
    fs.writeFileSync(STORE_FILE, JSON.stringify(data, null, 2), 'utf8');
  } catch (err) {
    logger.error({ err }, 'Failed to persist JSON store');
  }
}

class JsonStore {
  private data: StoreData;

  constructor() {
    this.data = loadFromDisk();
    logger.info(
      { mode: config.DATABASE_URL ? 'json+postgres-ready' : 'json-fallback', file: STORE_FILE },
      'Data store initialized',
    );
  }

  private persist(): void {
    saveToDisk(this.data);
  }

  getGuildConfig(guildId: string): GuildConfigRecord | null {
    return this.data.guildConfigs[guildId] ?? null;
  }

  getGuildSettings(guildId: string): GuildModuleSettings {
    return this.data.guildConfigs[guildId]?.config ?? { ...DEFAULT_SETTINGS };
  }

  upsertGuildConfig(
    guildId: string,
    patch: { name?: string; config?: Partial<GuildModuleSettings> },
  ): GuildConfigRecord {
    const existing = this.data.guildConfigs[guildId];
    const now = new Date().toISOString();

    const mergedConfig: GuildModuleSettings = {
      ...DEFAULT_SETTINGS,
      ...existing?.config,
      ...patch.config,
      channels: { ...DEFAULT_SETTINGS.channels, ...existing?.config?.channels, ...patch.config?.channels },
      roles: { ...DEFAULT_SETTINGS.roles, ...existing?.config?.roles, ...patch.config?.roles },
      verification: {
        minAccountAgeDays:
          patch.config?.verification?.minAccountAgeDays ??
          existing?.config?.verification?.minAccountAgeDays ??
          DEFAULT_SETTINGS.verification!.minAccountAgeDays,
      },
      automod: {
        ...DEFAULT_SETTINGS.automod,
        ...existing?.config?.automod,
        ...patch.config?.automod,
      },
      welcome: {
        ...DEFAULT_SETTINGS.welcome,
        ...existing?.config?.welcome,
        ...patch.config?.welcome,
      },
      antiRaid: {
        joinThreshold:
          patch.config?.antiRaid?.joinThreshold ??
          existing?.config?.antiRaid?.joinThreshold ??
          DEFAULT_SETTINGS.antiRaid!.joinThreshold,
        windowMs:
          patch.config?.antiRaid?.windowMs ??
          existing?.config?.antiRaid?.windowMs ??
          DEFAULT_SETTINGS.antiRaid!.windowMs,
      },
    };

    const record: GuildConfigRecord = {
      id: guildId,
      name: patch.name ?? existing?.name,
      locale: existing?.locale ?? 'de',
      config: mergedConfig,
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
    };

    this.data.guildConfigs[guildId] = record;
    this.persist();
    return record;
  }

  getOrCreateMember(guildId: string, userId: string): MemberRecord {
    const key = memberKey(guildId, userId);
    if (!this.data.members[key]) {
      this.data.members[key] = {
        guildId,
        userId,
        joinedAt: new Date().toISOString(),
        verified: false,
        xp: 0,
        level: 1,
        strikes: 0,
        streakDays: 0,
      };
      this.persist();
    }
    return this.data.members[key];
  }

  updateMember(guildId: string, userId: string, patch: Partial<MemberRecord>): MemberRecord {
    const member = this.getOrCreateMember(guildId, userId);
    Object.assign(member, patch);
    this.persist();
    return member;
  }

  getMember(guildId: string, userId: string): MemberRecord | null {
    return this.data.members[memberKey(guildId, userId)] ?? null;
  }

  getTopMembers(guildId: string, limit = 10): MemberRecord[] {
    return Object.values(this.data.members)
      .filter((m) => m.guildId === guildId)
      .sort((a, b) => b.xp - a.xp)
      .slice(0, limit);
  }

  nextCaseNumber(guildId: string): number {
    const next = (this.data.caseCounters[guildId] ?? 0) + 1;
    this.data.caseCounters[guildId] = next;
    this.persist();
    return next;
  }

  createCase(input: Omit<CaseRecord, 'id' | 'createdAt' | 'caseNumber'>): CaseRecord {
    const record: CaseRecord = {
      ...input,
      id: `case_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      caseNumber: this.nextCaseNumber(input.guildId),
      createdAt: new Date().toISOString(),
    };
    this.data.cases.push(record);
    this.persist();
    return record;
  }

  getCasesForUser(guildId: string, userId: string): CaseRecord[] {
    return this.data.cases
      .filter((c) => c.guildId === guildId && c.targetId === userId)
      .sort((a, b) => b.caseNumber - a.caseNumber);
  }

  getNotesForUser(guildId: string, userId: string): CaseRecord[] {
    return this.getCasesForUser(guildId, userId).filter((c) => c.type === 'note');
  }

  createAuditLog(input: Omit<AuditLogRecord, 'id' | 'createdAt'>): AuditLogRecord {
    const record: AuditLogRecord = {
      ...input,
      id: `audit_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      createdAt: new Date().toISOString(),
    };
    this.data.auditLogs.push(record);
    if (this.data.auditLogs.length > 5000) {
      this.data.auditLogs = this.data.auditLogs.slice(-5000);
    }
    this.persist();
    return record;
  }

  createTicket(input: Omit<TicketRecord, 'id' | 'createdAt' | 'status'>): TicketRecord {
    const record: TicketRecord = {
      ...input,
      id: `ticket_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      status: 'open',
      createdAt: new Date().toISOString(),
    };
    this.data.tickets.push(record);
    this.persist();
    return record;
  }

  getOpenTicket(guildId: string, userId: string): TicketRecord | null {
    return (
      this.data.tickets.find(
        (t) => t.guildId === guildId && t.userId === userId && t.status === 'open',
      ) ?? null
    );
  }

  getTicketByChannel(channelId: string): TicketRecord | null {
    return this.data.tickets.find((t) => t.channelId === channelId) ?? null;
  }

  updateTicket(channelId: string, patch: Partial<TicketRecord>): TicketRecord | null {
    const ticket = this.getTicketByChannel(channelId);
    if (!ticket) return null;
    Object.assign(ticket, patch);
    this.persist();
    return ticket;
  }

  closeTicket(channelId: string): TicketRecord | null {
    const ticket = this.getTicketByChannel(channelId);
    if (!ticket) return null;
    ticket.status = 'closed';
    ticket.closedAt = new Date().toISOString();
    this.persist();
    return ticket;
  }

  setCaptcha(userId: string, answer: number, ttlMs = 300_000): void {
    this.data.captchas[userId] = { answer, expiresAt: Date.now() + ttlMs };
    this.persist();
  }

  verifyCaptcha(userId: string, answer: number): boolean {
    const entry = this.data.captchas[userId];
    if (!entry || entry.expiresAt < Date.now()) {
      delete this.data.captchas[userId];
      this.persist();
      return false;
    }
    const ok = entry.answer === answer;
    delete this.data.captchas[userId];
    this.persist();
    return ok;
  }

  setTempVoice(
    guildId: string,
    channelId: string,
    ownerId: string,
    panel?: { panelChannelId: string; panelMessageId: string },
  ): void {
    this.data.tempVoice[guildId] = {
      channelId,
      ownerId,
      panelChannelId: panel?.panelChannelId,
      panelMessageId: panel?.panelMessageId,
      trusted: [],
      blocked: [],
    };
    this.persist();
  }

  getTempVoice(guildId: string): TempVoiceRecord | null {
    return this.data.tempVoice[guildId] ?? null;
  }

  updateTempVoice(guildId: string, patch: Partial<TempVoiceRecord>): TempVoiceRecord | null {
    const temp = this.getTempVoice(guildId);
    if (!temp) return null;
    Object.assign(temp, patch);
    this.persist();
    return temp;
  }

  trackSpamMessage(guildId: string, userId: string, windowMs: number): number {
    const key = `${guildId}:${userId}`;
    const now = Date.now();
    const entry = this.data.spamTracker[key] ?? { timestamps: [] };
    entry.timestamps = entry.timestamps.filter((t) => now - t < windowMs);
    entry.timestamps.push(now);
    this.data.spamTracker[key] = entry;
    this.persist();
    return entry.timestamps.length;
  }

  clearSpamTracker(guildId: string, userId: string): void {
    delete this.data.spamTracker[`${guildId}:${userId}`];
    this.persist();
  }

  removeTempVoice(guildId: string): void {
    delete this.data.tempVoice[guildId];
    this.persist();
  }

  trackRepeatedMessage(guildId: string, userId: string, text: string, windowMs: number): number {
    const key = `${guildId}:${userId}`;
    const now = Date.now();
    const normalized = text.trim().toLowerCase();
    const entry = this.data.messageTracker[key] ?? { contents: [] };
    entry.contents = entry.contents.filter((c) => now - c.at < windowMs);
    entry.contents.push({ text: normalized, at: now });
    this.data.messageTracker[key] = entry;
    this.persist();
    return entry.contents.filter((c) => c.text === normalized).length;
  }

  trackJoin(guildId: string, windowMs: number): number {
    const now = Date.now();
    const entry = this.data.joinTracker[guildId] ?? { timestamps: [] };
    entry.timestamps = entry.timestamps.filter((t) => now - t < windowMs);
    entry.timestamps.push(now);
    this.data.joinTracker[guildId] = entry;
    this.persist();
    return entry.timestamps.length;
  }

  clearJoinTracker(guildId: string): void {
    delete this.data.joinTracker[guildId];
    this.persist();
  }

  setVerifyAccepted(userId: string, ttlMs = 600_000): void {
    this.data.verifyAccepted[userId] = Date.now() + ttlMs;
    this.persist();
  }

  hasVerifyAccepted(userId: string): boolean {
    const exp = this.data.verifyAccepted[userId];
    if (!exp || exp < Date.now()) {
      delete this.data.verifyAccepted[userId];
      this.persist();
      return false;
    }
    return true;
  }

  createGiveaway(input: Omit<GiveawayRecord, 'id' | 'entrants'>): GiveawayRecord {
    const record: GiveawayRecord = {
      ...input,
      id: `gw_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      entrants: [],
    };
    this.data.giveaways[record.id] = record;
    this.persist();
    return record;
  }

  getGiveaway(id: string): GiveawayRecord | null {
    return this.data.giveaways[id] ?? null;
  }

  getGiveawayByMessage(messageId: string): GiveawayRecord | null {
    return Object.values(this.data.giveaways).find((g) => g.messageId === messageId) ?? null;
  }

  addGiveawayEntrant(id: string, userId: string): boolean {
    const gw = this.data.giveaways[id];
    if (!gw || gw.entrants.includes(userId)) return false;
    gw.entrants.push(userId);
    this.persist();
    return true;
  }

  removeGiveaway(id: string): void {
    delete this.data.giveaways[id];
    this.persist();
  }
}

export const store = new JsonStore();
