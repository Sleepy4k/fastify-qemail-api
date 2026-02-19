import type { Pool } from "mysql2/promise";
import type { ActivityLogRow, CountRow } from "../../types/index.ts";
import type { LogsQuery } from "./logs.schema.ts";

const ALLOWED_SORT = new Set(["created_at", "action", "actor_label", "status"]);

export class LogsService {
  constructor(private db: Pool) {}

  async list(q: LogsQuery) {
    const page = q.page ?? 1;
    const limit = q.limit ?? 50;
    const sortBy = ALLOWED_SORT.has(q.sort_by ?? "")
      ? q.sort_by!
      : "created_at";
    const sortDir = q.sort_dir === "asc" ? "ASC" : "DESC";
    const offset = (page - 1) * limit;

    const where: string[] = [];
    const params: unknown[] = [];

    if (q.actor_type) {
      where.push("actor_type = ?");
      params.push(q.actor_type);
    }
    if (q.action) {
      where.push("action LIKE ?");
      params.push(`${q.action}%`);
    }
    if (q.status) {
      where.push("status = ?");
      params.push(q.status);
    }
    if (q.resource_type) {
      where.push("resource_type = ?");
      params.push(q.resource_type);
    }
    if (q.search) {
      where.push(
        "(actor_label LIKE ? OR action LIKE ? OR resource_id LIKE ? OR ip_address LIKE ?)",
      );
      const like = `%${q.search}%`;
      params.push(like, like, like, like);
    }

    const whereClause = where.length ? `WHERE ${where.join(" AND ")}` : "";

    const [countRows] = await this.db.query<CountRow[]>(
      `SELECT COUNT(*) AS total FROM activity_logs ${whereClause}`,
      params,
    );
    const total = countRows[0]?.total ?? 0;

    const [rows] = await this.db.query<ActivityLogRow[]>(
      `SELECT id, actor_type, actor_id, actor_label, action, status,
              resource_type, resource_id, meta, ip_address, error, created_at
       FROM activity_logs
       ${whereClause}
       ORDER BY ${sortBy} ${sortDir}
       LIMIT ? OFFSET ?`,
      [...params, limit, offset],
    );

    return {
      data: rows.map((r) => ({
        ...r,
        meta: r.meta ?? null,
      })),
      meta: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    };
  }
}
