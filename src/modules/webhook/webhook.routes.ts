import type { FastifyInstance } from "fastify";
import { WebhookService } from "./webhook.service.ts";
import { WebhookController } from "./webhook.controller.ts";
import { IncomingEmailBody, WebhookReply } from "./webhook.schema.ts";

export async function webhookRoutes(app: FastifyInstance) {
  const svc = new WebhookService(app.db, app.redis);
  const ctrl = new WebhookController(svc);

  app.post(
    "/incoming-email",
    {
      schema: {
        tags: ["webhook"],
        summary: "Receive email from Cloudflare Worker",
        body: IncomingEmailBody,
        response: { 200: WebhookReply },
      },
    },
    (req, reply) => ctrl.incomingEmail(req as any, reply),
  );
}
