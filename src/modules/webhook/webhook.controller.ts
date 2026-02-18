import type { FastifyRequest, FastifyReply } from "fastify";
import type { WebhookService } from "./webhook.service.ts";
import type { IncomingEmailBody } from "./webhook.schema.ts";
import { env } from "../../config/env.ts";

export class WebhookController {
  constructor(private svc: WebhookService) {}

  async incomingEmail(
    req: FastifyRequest<{ Body: IncomingEmailBody }>,
    _reply: FastifyReply,
  ) {
    const secret = req.headers["x-webhook-secret"];
    if (!env.CF_WEBHOOK_SECRET || secret !== env.CF_WEBHOOK_SECRET) {
      throw Object.assign(new Error("Unauthorized webhook"), {
        statusCode: 401,
      });
    }

    const id = await this.svc.storeEmail(req.body);
    return { ok: true, id };
  }
}
