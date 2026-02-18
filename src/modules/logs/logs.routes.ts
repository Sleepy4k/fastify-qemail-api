import type { FastifyInstance } from "fastify";
import { LogsService } from "./logs.service.ts";
import { LogsController } from "./logs.controller.ts";
import { LogsQuery } from "./logs.schema.ts";

export async function logsRoutes(app: FastifyInstance) {
  const svc  = new LogsService(app.db);
  const ctrl = new LogsController(svc);

  app.addHook("onRequest", app.verifyAdmin);

  app.get(
    "/",
    {
      schema: {
        tags: ["admin"],
        summary: "List activity logs (paginated, searchable, sortable)",
        security: [{ bearer: [] }],
        querystring: LogsQuery,
      },
    },
    (req, reply) => ctrl.list(req as any, reply),
  );
}
