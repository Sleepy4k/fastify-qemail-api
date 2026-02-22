import type { Pool } from "mysql2/promise";

export type ActorType = "user" | "admin" | "system";
export type LogStatus = "success" | "failure";

export interface LogEntry {
  actor_type: ActorType;
  actor_id?: number | null;
  actor_label?: string | null;
  action: string;
  status?: LogStatus;
  resource_type?: string | null;
  resource_id?: string | null;
  meta?: Record<string, unknown> | null;
  ip_address?: string | null;
  error?: string | null;
}

export class LogService {
  constructor(private db: Pool) {}

  log(entry: LogEntry): void {
    const {
      actor_type,
      actor_id = null,
      actor_label = null,
      action,
      status = "success",
      resource_type = null,
      resource_id = null,
      meta = null,
      ip_address = null,
      error = null,
    } = entry;

    this.db
      .query(
        `INSERT INTO activity_logs
           (actor_type, actor_id, actor_label, action, status,
            resource_type, resource_id, meta, ip_address, error)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          actor_type,
          actor_id,
          actor_label,
          action,
          status,
          resource_type,
          resource_id,
          meta ? JSON.stringify(meta) : null,
          ip_address,
          error,
        ],
      )
      .catch(() => {
      });
  }
}
