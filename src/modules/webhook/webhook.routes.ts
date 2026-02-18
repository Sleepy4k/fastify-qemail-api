import type { FastifyInstance } from "fastify";
import { WebhookService } from "./webhook.service.ts";
import { WebhookController } from "./webhook.controller.ts";
import {
  IncomingEmailBody,
  WebhookReply,
  ForwardLookupQuery,
  ForwardLookupReply,
} from "./webhook.schema.ts";

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

  app.get(
    "/forward-lookup",
    {
      schema: {
        tags: ["webhook"],
        summary: "Look up forward-to address for a temp email (called by Worker)",
        querystring: ForwardLookupQuery,
        response: { 200: ForwardLookupReply },
      },
    },
    (req, reply) => ctrl.forwardLookup(req as any, reply),
  );
}
