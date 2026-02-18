import type { Pool, ResultSetHeader, RowDataPacket } from "mysql2/promise";
import type {
  DomainRow,
  AccountRow,
  EmailRow,
  CountRow,
} from "../../types/index.ts";
import {
  hashPassword,
  verifyPassword,
  randomUsername,
  randomToken,
} from "../../utils/crypto.ts";
import { env } from "../../config/env.ts";
import {
  createEmailRule,
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

export class EmailService {
  constructor(
    private db: Pool,
    private redis: RedisWithPrefix,
  ) {}

  async getActiveDomains(): Promise<Array<{ id: number; name: string }>> {
    const cached = await this.redis.get("domains:active");
    if (cached)
      return JSON.parse(cached) as Array<{ id: number; name: string }>;

    const [rows] = await this.db.query<DomainRow[]>(
      "SELECT id, name FROM domains WHERE is_active = 1 ORDER BY name",
    );

    const data = rows.map((r) => ({ id: r.id, name: r.name }));
    await this.redis.setEx("domains:active", 3600, JSON.stringify(data));
    return data;
  }

  async generate(
    domainId: number,
    username: string | undefined,
    password: string | undefined,
    ip: string,
  ) {
    // 1. IP rate-limit check
    const [countRows] = await this.db.query<CountRow[]>(
      "SELECT COUNT(*) AS total FROM accounts WHERE ip_address = ? AND created_at > DATE_SUB(NOW(), INTERVAL 1 HOUR)",
      [ip],
    );
    if ((countRows[0]?.total ?? 0) >= env.MAX_EMAILS_PER_IP) {
      throw Object.assign(new Error("Rate limit: too many emails created"), {
        statusCode: 429,
      });
    }

    // 2. Resolve domain (must be active and have a CF zone)
    const [domains] = await this.db.query<DomainRow[]>(
      "SELECT id, name, cloudflare_zone_id FROM domains WHERE id = ? AND is_active = 1",
      [domainId],
    );
    const domain = domains[0];
    if (!domain) {
      throw Object.assign(new Error("Domain not found or inactive"), {
        statusCode: 404,
      });
    }

    const name = username ?? randomUsername();
    const email = `${name.toLowerCase()}@${domain.name}`;

    // 3. Check for duplicate in DB
    const [existing] = await this.db.query<RowDataPacket[]>(
      "SELECT id FROM accounts WHERE email_address = ?",
      [email],
    );
    if (existing.length > 0) {
      throw Object.assign(new Error("Email address already taken"), {
        statusCode: 409,
      });
    }

    // 4. Create routing rule in Cloudflare FIRST
    //    If CF fails the whole request fails – no orphaned DB rows.
    let cfRuleId: string | null = null;
    if (domain.cloudflare_zone_id) {
      const rule = await createEmailRule(domain.cloudflare_zone_id, {
        name: `qemail-${email}`,
        toAddress: email,
        // Forward to the Worker which pushes to our webhook endpoint
        forwardTo: env.CF_WORKER_NAME,
        useWorker: true,
      });
      cfRuleId = rule.id;
    }

    // 5. Persist to database only after CF succeeded
    const passwordHash = password ? await hashPassword(password) : null;
    const sessionToken = randomToken();
    const expiresAt = new Date(Date.now() + env.EMAIL_EXPIRY_HOURS * 3600_000);

    let insertId: number;
    try {
      const [result] = await this.db.query<ResultSetHeader>(
        `INSERT INTO accounts
           (email_address, password_hash, domain_id, is_custom, session_token, cloudflare_rule_id, ip_address, expires_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [email, passwordHash, domainId, !!username, sessionToken, cfRuleId, ip, expiresAt],
      );
      insertId = result.insertId;
    } catch (dbErr) {
      // Roll back CF rule so we don't leave orphaned rules
      if (cfRuleId && domain.cloudflare_zone_id) {
        await deleteEmailRule(domain.cloudflare_zone_id, cfRuleId).catch(
          () => undefined,
        );
      }
      throw dbErr;
    }

    return { id: insertId, email, sessionToken, expiresAt };
  }

  async login(email: string, password: string) {
    const [rows] = await this.db.query<AccountRow[]>(
      "SELECT id, email_address, password_hash, session_token FROM accounts WHERE email_address = ?",
      [email],
    );
    const account = rows[0];
    if (!account?.password_hash) {
      throw Object.assign(new Error("Invalid credentials"), {
        statusCode: 401,
      });
    }

    const valid = await verifyPassword(account.password_hash, password);
    if (!valid) {
      throw Object.assign(new Error("Invalid credentials"), {
        statusCode: 401,
      });
    }

    return { id: account.id, email: account.email_address, sessionToken: account.session_token };
  }

  async getAccountByToken(token: string) {
    const [rows] = await this.db.query<AccountRow[]>(
      "SELECT id, email_address FROM accounts WHERE session_token = ? AND (expires_at IS NULL OR expires_at > NOW())",
      [token],
    );
    return rows[0] ?? null;
  }

  async getInbox(accountId: number, page: number, limit: number) {
    const offset = (page - 1) * limit;

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

    return { data: rows, total, page, limit, pages: Math.ceil(total / limit) };
  }

  async getMessage(accountId: number, messageId: string) {
    const [rows] = await this.db.query<EmailRow[]>(
      `SELECT id, message_id, sender, sender_name, recipient, subject, body_text, body_html, raw_headers, is_read, received_at
       FROM emails WHERE account_id = ? AND message_id = ?`,
      [accountId, messageId],
    );
    const msg = rows[0];
    if (!msg) {
      throw Object.assign(new Error("Message not found"), { statusCode: 404 });
    }

    if (!msg.is_read) {
      await this.db.query("UPDATE emails SET is_read = 1 WHERE id = ?", [
        msg.id,
      ]);
    }

    return msg;
  }

  async deleteMessage(accountId: number, messageId: string) {
    const [result] = await this.db.query<ResultSetHeader>(
      "DELETE FROM emails WHERE account_id = ? AND message_id = ?",
      [accountId, messageId],
    );
    if (result.affectedRows === 0) {
      throw Object.assign(new Error("Message not found"), { statusCode: 404 });
    }
  }

  /**
   * Delete a temp-email account together with its Cloudflare routing rule.
   * The CF rule is removed first; if it fails, deletion is aborted.
   */
  async deleteAccount(sessionToken: string) {
    const [rows] = await this.db.query<
      (AccountRow & { cloudflare_zone_id: string | null })[]
    >(
      `SELECT a.id, a.cloudflare_rule_id, d.cloudflare_zone_id
       FROM accounts a
       JOIN domains d ON a.domain_id = d.id
       WHERE a.session_token = ?`,
      [sessionToken],
    );
    const account = rows[0];
    if (!account) {
      throw Object.assign(new Error("Account not found"), { statusCode: 404 });
    }

    // Remove CF rule before touching DB
    if (account.cloudflare_rule_id && account.cloudflare_zone_id) {
      await deleteEmailRule(
        account.cloudflare_zone_id,
        account.cloudflare_rule_id,
      );
    }

    await this.db.query("DELETE FROM accounts WHERE id = ?", [account.id]);
  }
}
