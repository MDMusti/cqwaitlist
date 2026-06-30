import { z } from 'zod';

const envSchema = z.object({
  BOT_TOKEN: z.string().min(1, 'BOT_TOKEN is required'),
  CLIENT_ID: z.string().min(1, 'CLIENT_ID is required'),
  GUILD_ID: z.string().optional(),
  DATABASE_URL: z.string().url().optional(),
  REDIS_URL: z.string().optional(),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']).optional(),
  NODE_ENV: z.enum(['development', 'production', 'test']).optional(),
});

export type EnvConfig = z.infer<typeof envSchema>;

export function loadConfig(): EnvConfig {
  const parsed = envSchema.safeParse(process.env);

  if (!parsed.success) {
    const issues = parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('\n');
    throw new Error(`Invalid environment configuration:\n${issues}`);
  }

  return parsed.data;
}

export const config = loadConfig();
