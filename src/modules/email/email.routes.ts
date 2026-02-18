import type { FastifyInstance } from "fastify";
import { EmailService } from "./email.service.ts";
import { EmailController } from "./email.controller.ts";
import {
  GenerateBody,
  GenerateReply,
  LoginBody,
  LoginReply,
  InboxParams,
  InboxQuery,
  MessageParams,
  DomainItem,
  UpdateForwardBody,
} from "./email.schema.ts";
import { Type } from "@sinclair/typebox";

export async function emailRoutes(app: FastifyInstance) {
  const svc = new EmailService(app.db, app.redis);
  const ctrl = new EmailController(svc);

  app.get(
    "/domains",
    { schema: { tags: ["email"], summary: "List active domains", response: { 200: Type.Array(DomainItem) } } },
    (req, reply) => ctrl.domains(req, reply),
  );

  app.post(
    "/generate",
    {
      config: { rateLimit: { max: 10, timeWindow: "15 minutes" } },
      schema: { tags: ["email"], summary: "Generate temp email", body: GenerateBody, response: { 201: GenerateReply } },
    },
    (req, reply) => ctrl.generate(req as any, reply),
  );

  app.post(
    "/login",
    {
      config: { rateLimit: { max: 5, timeWindow: "5 minutes" } },
      schema: { tags: ["email"], summary: "Login to protected email", body: LoginBody, response: { 200: LoginReply } },
    },
    (req, reply) => ctrl.login(req as any, reply),
  );

  app.get(
    "/inbox/:token",
    { schema: { tags: ["email"], summary: "Get inbox", params: InboxParams, querystring: InboxQuery } },
    (req, reply) => ctrl.inbox(req as any, reply),
  );

  app.get(
    "/inbox/:token/:messageId",
    { schema: { tags: ["email"], summary: "Read message", params: MessageParams } },
    (req, reply) => ctrl.message(req as any, reply),
  );

  app.delete(
    "/inbox/:token/:messageId",
    { schema: { tags: ["email"], summary: "Delete message", params: MessageParams } },
    (req, reply) => ctrl.deleteMessage(req as any, reply),
  );

  app.patch(
    "/inbox/:token/forward",
    {
      schema: {
        tags: ["email"],
        summary: "Update or clear the forward-to address for this account",
        params: InboxParams,
        body: UpdateForwardBody,
      },
    },
    (req, reply) => ctrl.updateForward(req as any, reply),
  );

  app.delete(
    "/inbox/:token",
    { schema: { tags: ["email"], summary: "Delete account", params: InboxParams } },
    (req, reply) => ctrl.deleteAccount(req as any, reply),
  );
}
