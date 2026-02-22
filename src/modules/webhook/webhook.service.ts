import type { Pool, ResultSetHeader } from "mysql2/promise";
import type { AccountRow } from "../../types/index.ts";
import type { IncomingEmailBody } from "./webhook.schema.ts";
import type { AttachmentStorage } from "../../utils/attachment-storage.ts";

interface RedisWithPrefix {
  del: (key: string) => Promise<number>;
}

export class WebhookService {
  constructor(
    private db: Pool,
    private redis: RedisWithPrefix,
    private storage: AttachmentStorage,
  ) {}

  async getForwardTarget(to: string): Promise<string | null> {
    const [rows] = await this.db.query<AccountRow[]>(
      "SELECT forward_to FROM accounts WHERE email_address = ? AND (expires_at IS NULL OR expires_at > NOW())",
      [to],
    );
    return rows[0]?.forward_to ?? null;
  }

  async storeEmail(
    payload: IncomingEmailBody,
    to: string,
    from: string,
  ): Promise<number> {
    const { messageId, subject, text, html, attachments = [] } = payload;
    const [rows] = await this.db.query<AccountRow[]>(
      "SELECT id FROM accounts WHERE email_address = ? AND (expires_at IS NULL OR expires_at > NOW())",
      [to],
    );
    const account = rows[0];
    if (!account) {
      throw Object.assign(new Error(`No active account for ${to}`), {
        statusCode: 404,
      });
    }

    const match = from.match(/^(.+?)\s*<(.+?)>$/);
    const senderName = match?.[1]?.trim() ?? null;
    const senderEmail = match?.[2]?.trim() ?? from;

    const [result] = await this.db.query<ResultSetHeader>(
      `INSERT INTO emails
         (account_id, message_id, sender, sender_name, recipient, subject, body_text, body_html, received_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
      [
        account.id,
        messageId,
        senderEmail,
        senderName,
        to,
        subject || "(No Subject)",
        text ?? null,
        html ?? null,
      ],
    );
    const emailId = result.insertId;

    for (const att of attachments) {
      try {
        const storedName = await this.storage.save(
          att.path,
          att.filename,
          att.mimeType,
        );
        await this.db.query(
          `INSERT INTO email_attachments (email_id, original_filename, stored_name, mime_type, size)
           VALUES (?, ?, ?, ?, ?)`,
          [emailId, att.filename, storedName, att.mimeType, att.size],
        );
      } catch (err) {
        console.error(
          `[webhook] Failed to save attachment "${att.filename}":`,
          err,
        );
      }
    }

    await this.redis.del(`inbox:${account.id}:version`);
    await this.redis.del(`admin:inbox:${account.id}:version`);

    return emailId;
  }
}
