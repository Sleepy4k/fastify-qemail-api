import type { FastifyRequest, FastifyReply } from "fastify";
import type { WebhookService } from "./webhook.service.ts";
import type { LogService } from "../../utils/log-service.ts";
import type {
  IncomingEmailBody,
  ForwardLookupQuery,
} from "./webhook.schema.ts";

export class WebhookController {
  constructor(
    private svc: WebhookService,
    private log: LogService,
    private cfWebhookSecret: string,
  ) {}

  private checkSecret(req: FastifyRequest) {
    const secret = req.headers["x-webhook-secret"];
    if (!this.cfWebhookSecret || secret !== this.cfWebhookSecret) {
      throw Object.assign(new Error("Unauthorized"), { statusCode: 401 });
    }
  }

  async incomingEmail(
    req: FastifyRequest<{ Body: IncomingEmailBody }>,
    _reply: FastifyReply,
  ) {
    this.checkSecret(req);

    const to =
      (req.headers["x-email-to"] as string | undefined)?.trim() || "unknown";
    const from =
      (req.headers["x-email-from"] as string | undefined)?.trim() || "unknown";

    try {
      const id = await this.svc.storeEmail(req.body, to, from);
      this.log.log({
        actor_type: "system",
        actor_label: "cloudflare-worker",
        action: "webhook.email_received",
        resource_type: "email",
        resource_id: req.body.messageId,
        meta: {
          to,
          from,
          subject: req.body.subject,
          attachment_count: req.body.attachments?.length ?? 0,
          stored_id: id,
        },
        ip_address: req.ip,
      });
      return { ok: true, id };
    } catch (err: any) {
      this.log.log({
        actor_type: "system",
        actor_label: "cloudflare-worker",
        action: "webhook.email_received",
        status: "failure",
        resource_type: "email",
        resource_id: req.body.messageId,
        meta: { to, from },
        ip_address: req.ip,
        error: err?.message,
      });
      throw err;
    }
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
