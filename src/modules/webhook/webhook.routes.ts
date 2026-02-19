import type { FastifyInstance } from "fastify";
import { simpleParser } from "mailparser";
import { WebhookService } from "./webhook.service.ts";
import { WebhookController } from "./webhook.controller.ts";
import { LogService } from "../../utils/log-service.ts";
import {
  IncomingEmailBody,
  WebhookReply,
  ForwardLookupQuery,
  ForwardLookupReply,
} from "./webhook.schema.ts";

async function parseMimeEmail(buf: Buffer) {
  const parsed = await simpleParser(buf);

  const messageId = (parsed.messageId ?? `noId.${Date.now()}@local`)
    .replace(/[<>]/g, "")
    .trim();

  const attachments = (parsed.attachments ?? []).map((a) => ({
    filename: a.filename ?? "attachment",
    path: a.content.toString("base64"),
    mimeType: a.contentType,
    size: a.size,
  }));

  return {
    messageId,
    subject: parsed.subject ?? "(no subject)",
    text: parsed.text ?? undefined,
    html: typeof parsed.html === "string" ? parsed.html : undefined,
    attachments: attachments.length > 0 ? attachments : undefined,
  };
}

export async function webhookRoutes(app: FastifyInstance) {
  const mimeParser = async (_req: any, body: Buffer) => parseMimeEmail(body);

  for (const ct of ["application/octet-stream", "message/rfc822"] as const) {
    app.addContentTypeParser(ct, { parseAs: "buffer" }, mimeParser);
  }

  const svc = new WebhookService(app.db, app.redis);
  const log = new LogService(app.db);
  const ctrl = new WebhookController(svc, log);

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
        summary:
          "Look up forward-to address for a temp email (called by Worker)",
        querystring: ForwardLookupQuery,
        response: { 200: ForwardLookupReply },
      },
    },
    (req, reply) => ctrl.forwardLookup(req as any, reply),
  );
}
