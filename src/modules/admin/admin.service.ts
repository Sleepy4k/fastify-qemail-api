import type { Pool, ResultSetHeader, RowDataPacket } from "mysql2/promise";
import type {
  AdminRow,
  DomainRow,
  AccountRow,
  EmailRow,
  CountRow,
  SettingRow,
} from "../../types/index.ts";
import { verifyPassword } from "../../utils/crypto.ts";
import {
  resolveCreds,
  verifyZone,
  enableEmailRouting,
  disableEmailRouting,
  listEmailRules,
  deleteEmailRule,
} from "../../utils/cloudflare.ts";

interface RedisWithPrefix {
  get: (key: string) => Promise<string | null>;
  setEx: (
    key: string,
    seconds: number,
    value: string,
  ) => Promise<string | null>;
  del: (key: string) => Promise<number>;
}

interface DomainListItem {
  id: number;
  name: string;
  cloudflare_zone_id: string | null;
  cloudflare_routing_enabled: boolean;
  cf_api_token_set: boolean;
  cf_account_id: string | null;
  cf_worker_name: string | null;
  is_active: boolean;
  created_at: Date;
  updated_at: Date;
}

function maskDomain(row: DomainRow): DomainListItem {
  return {
    id: row.id,
    name: row.name,
    cloudflare_zone_id: row.cloudflare_zone_id,
    cloudflare_routing_enabled: row.cloudflare_routing_enabled,
    cf_api_token_set: !!row.cf_api_token,
    cf_account_id: row.cf_account_id,
    cf_worker_name: row.cf_worker_name,
    is_active: row.is_active,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

export class AdminService {
  constructor(
    private db: Pool,
    private redis: RedisWithPrefix,
  ) {}

  private async invalidateStatsCache() {
    await this.redis.del("admin:stats");
  }

  async login(username: string, password: string) {
    const [rows] = await this.db.query<AdminRow[]>(
      "SELECT * FROM admin_users WHERE username = ? AND is_active = 1",
      [username],
    );
    const admin = rows[0];
    if (!admin)
      throw Object.assign(new Error("Invalid credentials"), { statusCode: 401 });

    const ok = await verifyPassword(admin.password_hash, password);
    if (!ok)
      throw Object.assign(new Error("Invalid credentials"), { statusCode: 401 });

    await this.db.query(
      "UPDATE admin_users SET last_login_at = NOW() WHERE id = ?",
      [admin.id],
    );
    return { id: admin.id, username: admin.username, role: admin.role };
  }

  async stats() {
    const cached = await this.redis.get("admin:stats");
    if (cached) return JSON.parse(cached);

    const q = async (sql: string) => {
      const [r] = await this.db.query<CountRow[]>(sql);
      return r[0]?.total ?? 0;
    };

    const stats = {
      total_accounts: await q("SELECT COUNT(*) AS total FROM accounts"),
      total_emails: await q("SELECT COUNT(*) AS total FROM emails"),
      total_domains: await q("SELECT COUNT(*) AS total FROM domains"),
      active_accounts: await q(
        "SELECT COUNT(*) AS total FROM accounts WHERE expires_at > NOW() OR expires_at IS NULL",
      ),
    };

    await this.redis.setEx("admin:stats", 60, JSON.stringify(stats));
    return stats;
  }

  async listDomains(): Promise<DomainListItem[]> {
    const [rows] = await this.db.query<DomainRow[]>(
      "SELECT * FROM domains ORDER BY created_at DESC",
    );
    return rows.map(maskDomain);
  }

  async createDomain(
    name: string,
    zoneId?: string,
    cfFields: {
      cf_api_token?: string | null;
      cf_account_id?: string | null;
      cf_worker_name?: string | null;
    } = {},
  ) {
    let routingEnabled = false;

    if (zoneId) {
      const creds = resolveCreds(cfFields);

      const valid = await verifyZone(zoneId, creds);
      if (!valid) {
        throw Object.assign(
          new Error(`Cloudflare zone ${zoneId} is not active or unreachable`),
          { statusCode: 422 },
        );
      }

      const routing = await enableEmailRouting(zoneId, creds);
      routingEnabled = routing.enabled ?? false;
    }

    const [result] = await this.db.query<ResultSetHeader>(
      `INSERT INTO domains
         (name, cloudflare_zone_id, cloudflare_routing_enabled, cf_api_token, cf_account_id, cf_worker_name)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [
        name,
        zoneId ?? null,
        routingEnabled,
        cfFields.cf_api_token || null,
        cfFields.cf_account_id || null,
        cfFields.cf_worker_name || null,
      ],
    );

    await this.redis.del("domains:active");
    await this.invalidateStatsCache();
    return result.insertId;
  }

  async updateDomain(
    id: number,
    data: {
      is_active?: boolean;
      cloudflare_zone_id?: string | null;
      cf_api_token?: string | null;
      cf_account_id?: string | null;
      cf_worker_name?: string | null;
    },
  ) {
    const [domainRows] = await this.db.query<DomainRow[]>(
      "SELECT * FROM domains WHERE id = ?",
      [id],
    );
    const current = domainRows[0];
    if (!current) {
      throw Object.assign(new Error("Domain not found"), { statusCode: 404 });
    }

    const effectiveCfToken =
      data.cf_api_token !== undefined ? data.cf_api_token : current.cf_api_token;
    const effectiveCfAccountId =
      data.cf_account_id !== undefined ? data.cf_account_id : current.cf_account_id;

    const newCreds = resolveCreds({
      cf_api_token: effectiveCfToken || null,
      cf_account_id: effectiveCfAccountId || null,
    });

    const newZoneId =
      data.cloudflare_zone_id !== undefined
        ? data.cloudflare_zone_id
        : current.cloudflare_zone_id;

    const zoneOrTokenChanged =
      (data.cloudflare_zone_id !== undefined &&
        data.cloudflare_zone_id !== current.cloudflare_zone_id) ||
      (data.cf_api_token !== undefined &&
        data.cf_api_token !== current.cf_api_token);

    let cfRoutingEnabled: boolean | undefined;

    if (newZoneId) {
      if (zoneOrTokenChanged) {
        const valid = await verifyZone(newZoneId, newCreds);
        if (!valid) {
          throw Object.assign(
            new Error(`Cloudflare zone ${newZoneId} is not active or unreachable`),
            { statusCode: 422 },
          );
        }
        const routing = await enableEmailRouting(newZoneId, newCreds);
        cfRoutingEnabled = routing.enabled;
      } else if (data.is_active !== undefined) {
        if (data.is_active) {
          const routing = await enableEmailRouting(newZoneId, newCreds);
          cfRoutingEnabled = routing.enabled;
        } else {
          const routing = await disableEmailRouting(newZoneId, newCreds);
          cfRoutingEnabled = routing.enabled;
        }
      }
    }

    const sets: string[] = [];
    const vals: unknown[] = [];

    if (data.is_active !== undefined) { sets.push("is_active = ?"); vals.push(data.is_active); }
    if (data.cloudflare_zone_id !== undefined) { sets.push("cloudflare_zone_id = ?"); vals.push(data.cloudflare_zone_id || null); }
    if (data.cf_api_token !== undefined) { sets.push("cf_api_token = ?"); vals.push(data.cf_api_token || null); }
    if (data.cf_account_id !== undefined) { sets.push("cf_account_id = ?"); vals.push(data.cf_account_id || null); }
    if (data.cf_worker_name !== undefined) { sets.push("cf_worker_name = ?"); vals.push(data.cf_worker_name || null); }
    if (cfRoutingEnabled !== undefined) { sets.push("cloudflare_routing_enabled = ?"); vals.push(cfRoutingEnabled); }

    if (sets.length === 0) return;
    vals.push(id);

    await this.db.query(`UPDATE domains SET ${sets.join(", ")} WHERE id = ?`, vals);
    await this.redis.del("domains:active");
  }

  async deleteDomain(id: number) {
    const [domainRows] = await this.db.query<DomainRow[]>(
      "SELECT * FROM domains WHERE id = ?",
      [id],
    );
    const domain = domainRows[0];

    if (domain?.cloudflare_zone_id) {
      const zoneId = domain.cloudflare_zone_id;
      const creds = resolveCreds(domain);

      const [accountRows] = await this.db.query<AccountRow[]>(
        "SELECT cloudflare_rule_id FROM accounts WHERE domain_id = ? AND cloudflare_rule_id IS NOT NULL",
        [id],
      );

      await Promise.allSettled(
        accountRows
          .filter((a) => a.cloudflare_rule_id)
          .map((a) => deleteEmailRule(zoneId, a.cloudflare_rule_id!, creds)),
      );

      await disableEmailRouting(zoneId, creds).catch(() => undefined);
    }

    await this.db.query("DELETE FROM domains WHERE id = ?", [id]);
    await this.redis.del("domains:active");
    await this.invalidateStatsCache();
  }

  async listAccounts(page: number, limit: number, search?: string) {
    const offset = (page - 1) * limit;
    let where = "";
    const params: unknown[] = [];

    if (search) {
      where = "WHERE a.email_address LIKE ?";
      params.push(`%${search}%`);
    }

    const [countRows] = await this.db.query<CountRow[]>(
      `SELECT COUNT(*) AS total FROM accounts a ${where}`,
      params,
    );
    const total = countRows[0]?.total ?? 0;

    const [rows] = await this.db.query<RowDataPacket[]>(
      `SELECT
        a.id, a.email_address, a.domain_id,
        d.name as domain_name, a.is_custom, a.ip_address,
        a.expires_at, a.created_at,
        (SELECT COUNT(*) FROM emails WHERE account_id = a.id) as email_count
       FROM accounts a
       LEFT JOIN domains d ON a.domain_id = d.id
       ${where}
       ORDER BY a.created_at DESC
       LIMIT ? OFFSET ?`,
      [...params, limit, offset],
    );

    return {
      accounts: rows.map((r) => ({
        id: r["id"] as number,
        email_address: r["email_address"] as string,
        domain_id: r["domain_id"] as number,
        domain_name: r["domain_name"] as string,
        is_custom: Boolean(r["is_custom"]),
        ip_address: r["ip_address"] as string | null,
        expires_at: r["expires_at"] as string | null,
        created_at: r["created_at"] as string,
        email_count: r["email_count"] as number,
      })),
      total,
      page,
      limit,
      total_pages: Math.ceil(total / limit),
    };
  }

  async deleteAccount(accountId: number) {
    const [rows] = await this.db.query<
      (AccountRow & {
        cloudflare_zone_id: string | null;
        cf_api_token: string | null;
        cf_account_id: string | null;
      })[]
    >(
      `SELECT a.id, a.cloudflare_rule_id,
              d.cloudflare_zone_id, d.cf_api_token, d.cf_account_id
       FROM accounts a
       JOIN domains d ON a.domain_id = d.id
       WHERE a.id = ?`,
      [accountId],
    );
    const account = rows[0];
    if (!account) {
      throw Object.assign(new Error("Account not found"), { statusCode: 404 });
    }

    if (account.cloudflare_rule_id && account.cloudflare_zone_id) {
      const creds = resolveCreds({
        cf_api_token: account.cf_api_token,
        cf_account_id: account.cf_account_id,
      });
      await deleteEmailRule(
        account.cloudflare_zone_id,
        account.cloudflare_rule_id,
        creds,
      );
    }

    await this.db.query("DELETE FROM accounts WHERE id = ?", [accountId]);
    await this.invalidateStatsCache();
  }

  async inspectInbox(accountId: number, page: number, limit: number) {
    const offset = (page - 1) * limit;

    const [accountRows] = await this.db.query<
      (AccountRow & { domain_name: string })[]
    >(
      `SELECT a.id, a.email_address, a.is_custom, d.name AS domain_name
       FROM accounts a
       LEFT JOIN domains d ON a.domain_id = d.id
       WHERE a.id = ?`,
      [accountId],
    );
    const account = accountRows[0];
    if (!account) {
      throw Object.assign(new Error("Account not found"), { statusCode: 404 });
    }

    const [countRows] = await this.db.query<CountRow[]>(
      "SELECT COUNT(*) AS total FROM emails WHERE account_id = ?",
      [accountId],
    );
    const total = countRows[0]?.total ?? 0;

    const [rows] = await this.db.query<EmailRow[]>(
      `SELECT id, message_id, sender, sender_name, subject, body_text, body_html, is_read, received_at
       FROM emails WHERE account_id = ? ORDER BY received_at DESC LIMIT ? OFFSET ?`,
      [accountId, limit, offset],
    );

    return {
      account: {
        id: account.id,
        email_address: account.email_address,
        domain_name: account.domain_name || "Unknown",
        is_custom: Boolean(account.is_custom),
      },
      emails: rows.map((r) => ({
        id: r.id,
        message_id: r.message_id,
        sender: r.sender,
        sender_name: r.sender_name,
        subject: r.subject,
        is_read: Boolean(r.is_read),
        received_at: r.received_at,
      })),
      total,
      page,
      limit,
      total_pages: Math.ceil(total / limit),
    };
  }

  async getDomainCfRules(domainId: number) {
    const [domainRows] = await this.db.query<DomainRow[]>(
      "SELECT * FROM domains WHERE id = ?",
      [domainId],
    );
    const domain = domainRows[0];
    if (!domain?.cloudflare_zone_id) return [];
    const creds = resolveCreds(domain);
    return listEmailRules(domain.cloudflare_zone_id, creds);
  }

  async getSettings() {
    const cached = await this.redis.get("admin:settings");
    if (cached) return JSON.parse(cached);

    const [rows] = await this.db.query<SettingRow[]>(
      "SELECT * FROM settings ORDER BY `key`",
    );
    await this.redis.setEx("admin:settings", 300, JSON.stringify(rows));
    return rows;
  }

  async upsertSetting(key: string, value: string) {
    await this.db.query(
      "INSERT INTO settings (`key`, value) VALUES (?, ?) ON DUPLICATE KEY UPDATE value = VALUES(value)",
      [key, value],
    );
    await this.redis.del("admin:settings");
  }
}
