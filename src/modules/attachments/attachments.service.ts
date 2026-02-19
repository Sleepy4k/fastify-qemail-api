import type { Pool } from "mysql2/promise";
import type { AttachmentRow } from "../../types/index.ts";

export interface AttachmentMeta {
  mime_type: string;
  original_filename: string;
}

export class AttachmentsService {
  constructor(private db: Pool) {}

  async findByStoredName(storedName: string): Promise<AttachmentMeta | null> {
    const [rows] = await this.db.query<AttachmentRow[]>(
      "SELECT mime_type, original_filename FROM email_attachments WHERE stored_name = ?",
      [storedName],
    );
    const row = rows[0];
    if (!row) return null;
    return {
      mime_type: row.mime_type,
      original_filename: row.original_filename,
    };
  }
}
