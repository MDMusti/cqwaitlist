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

interface StoreData {
  guildConfigs: Record<string, GuildConfigRecord>;
  members: Record<string, MemberRecord>;
  cases: CaseRecord[];
  auditLogs: AuditLogRecord[];
  tickets: TicketRecord[];
  caseCounters: Record<string, number>;
  captchas: Record<string, { answer: number; expiresAt: number }>;
  tempVoice: Record<string, { ownerId: string; channelId: string }>;
}

const DEFAULT_SETTINGS: GuildModuleSettings = {
  channels: {},
  roles: {},
  verification: { minAccountAgeDays: 7 },
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
    return this.data.cases.filter((c) => c.guildId === guildId && c.targetId === userId);
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

  setTempVoice(guildId: string, channelId: string, ownerId: string): void {
    this.data.tempVoice[guildId] = { channelId, ownerId };
    this.persist();
  }

  getTempVoice(guildId: string): { ownerId: string; channelId: string } | null {
    return this.data.tempVoice[guildId] ?? null;
  }

  removeTempVoice(guildId: string): void {
    delete this.data.tempVoice[guildId];
    this.persist();
  }
}

export const store = new JsonStore();
