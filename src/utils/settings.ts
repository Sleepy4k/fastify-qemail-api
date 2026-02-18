import type { Pool } from "mysql2/promise";
import type { SettingRow } from "../types/index.ts";

interface RedisWithPrefix {
  get: (key: string) => Promise<string | null>;
  setEx: (key: string, seconds: number, value: string) => Promise<string | null>;
  del: (key: string) => Promise<number>;
}

const SETTINGS_CACHE_KEY = "admin:settings";
const SETTINGS_CACHE_TTL = 300;

export class SettingsService {
  constructor(
    private db: Pool,
    private redis: RedisWithPrefix,
  ) {}

  private async loadAll(): Promise<Record<string, string>> {
    const cached = await this.redis.get(SETTINGS_CACHE_KEY);
    if (cached) {
      const rows = JSON.parse(cached) as { key: string; value: string }[];
      return Object.fromEntries(rows.map((r) => [r.key, r.value]));
    }

    const [rows] = await this.db.query<SettingRow[]>(
      "SELECT * FROM settings ORDER BY `key`",
    );
    await this.redis.setEx(SETTINGS_CACHE_KEY, SETTINGS_CACHE_TTL, JSON.stringify(rows));
    return Object.fromEntries(rows.map((r) => [r.key, r.value]));
  }

  async get(key: string): Promise<string | null> {
    const all = await this.loadAll();
    return all[key] ?? null;
  }

  async getMaxEmailsPerIp(): Promise<number> {
    const val = await this.get("max_emails_per_ip");
    const parsed = val ? parseInt(val, 10) : NaN;
    return isNaN(parsed) ? 10 : parsed;
  }

  async getEmailExpiryHours(): Promise<number> {
    const val = await this.get("email_expiry_hours");
    const parsed = val ? parseInt(val, 10) : NaN;
    return isNaN(parsed) ? 24 : parsed;
  }

  async isRegistrationEnabled(): Promise<boolean> {
    const val = await this.get("registration_enabled");
    if (val === null) return true;
    return val.toLowerCase() === "true" || val === "1";
  }
}
