import type { FastifyRequest, FastifyReply } from "fastify";
import type { WebhookService } from "./webhook.service.ts";
import type { IncomingEmailBody, ForwardLookupQuery } from "./webhook.schema.ts";
import { env } from "../../config/env.ts";

export class WebhookController {
  constructor(private svc: WebhookService) {}

  private checkSecret(req: FastifyRequest) {
    const secret = req.headers["x-webhook-secret"];
    if (!env.CF_WEBHOOK_SECRET || secret !== env.CF_WEBHOOK_SECRET) {
      throw Object.assign(new Error("Unauthorized"), { statusCode: 401 });
    }
  }

  async incomingEmail(
    req: FastifyRequest<{ Body: IncomingEmailBody }>,
    _reply: FastifyReply,
  ) {
    this.checkSecret(req);
    const id = await this.svc.storeEmail(req.body);
    return { ok: true, id };
  }

  async forwardLookup(
    req: FastifyRequest<{ Querystring: ForwardLookupQuery }>,
    _reply: FastifyReply,
  ) {
    this.checkSecret(req);
    const forward_to = await this.svc.getForwardTarget(req.query.to);
    return { forward_to };
  }
}
