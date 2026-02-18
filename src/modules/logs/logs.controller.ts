import type { FastifyRequest, FastifyReply } from "fastify";
import type { LogsService } from "./logs.service.ts";
import type { LogsQuery } from "./logs.schema.ts";

export class LogsController {
  constructor(private svc: LogsService) {}

  async list(
    req: FastifyRequest<{ Querystring: LogsQuery }>,
    _reply: FastifyReply,
  ) {
    return this.svc.list(req.query);
  }
}
