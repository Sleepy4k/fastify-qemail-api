import type { Pool, ResultSetHeader } from "mysql2/promise";
import type { AccountRow } from "../../types/index.ts";
import type { IncomingEmailBody } from "./webhook.schema.ts";

interface RedisWithPrefix {
  del: (key: string) => Promise<number>;
}

export class WebhookService {
  constructor(
    private db: Pool,
    private redis: RedisWithPrefix,
  ) {}

  async getForwardTarget(to: string): Promise<string | null> {
    const [rows] = await this.db.query<AccountRow[]>(
      "SELECT forward_to FROM accounts WHERE email_address = ? AND (expires_at IS NULL OR expires_at > NOW())",
      [to],
    );
    return rows[0]?.forward_to ?? null;
  }

  async storeEmail(payload: IncomingEmailBody): Promise<number> {
    const { to, from: sender, subject, text, html, headers, messageId, receivedAt } = payload;

    const [rows] = await this.db.query<AccountRow[]>(
      "SELECT id FROM accounts WHERE email_address = ? AND (expires_at IS NULL OR expires_at > NOW())",
      [to],
    );
    const account = rows[0];
    if (!account) {
      throw Object.assign(new Error(`No active account for ${to}`), { statusCode: 404 });
    }

    const match = sender.match(/^(.+?)\s*<(.+?)>$/);
    const senderName = match?.[1]?.trim() ?? null;
    const senderEmail = match?.[2]?.trim() ?? sender;

    const [result] = await this.db.query<ResultSetHeader>(
      `INSERT INTO emails (account_id, message_id, sender, sender_name, recipient, subject, body_text, body_html, raw_headers, received_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        account.id,
        messageId,
        senderEmail,
        senderName,
        to,
        subject || "(No Subject)",
        text ?? null,
        html ?? null,
        headers ? JSON.stringify(headers) : null,
        new Date(receivedAt),
      ],
    );

    await this.redis.del(`inbox:${account.id}`);
    return result.insertId;
  }
}
