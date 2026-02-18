import type { FastifyRequest, FastifyReply } from "fastify";
import type { EmailService } from "./email.service.ts";
import type { LogService } from "../../utils/log-service.ts";
import type {
  GenerateBody,
  LoginBody,
  InboxParams,
  InboxQuery,
  MessageParams,
  UpdateForwardBody,
} from "./email.schema.ts";
import { env } from "../../config/env.ts";

export class EmailController {
  constructor(
    private svc: EmailService,
    private log: LogService,
  ) {}

  async domains(_req: FastifyRequest, _reply: FastifyReply) {
    return this.svc.getActiveDomains();
  }

  async generate(req: FastifyRequest<{ Body: GenerateBody }>, reply: FastifyReply) {
    const registrationEnabled = await this.svc.getSettings().isRegistrationEnabled();
    if (!registrationEnabled) {
      throw Object.assign(new Error("Registration is currently disabled"), { statusCode: 403 });
    }

    const { domain_id, username, password, is_custom, forward_to } = req.body;
    try {
      const result = await this.svc.generate(
        domain_id, username, password, req.ip, is_custom, forward_to,
      );

      let token = null;
      if (password) {
        token = await reply.jwtSign(
          { sub: result.id, email: result.email, type: "user" },
          { expiresIn: env.JWT_EXPIRES_IN },
        );
      }

      this.log.log({
        actor_type: "user",
        actor_label: result.email,
        action: "email.generate",
        resource_type: "account",
        resource_id: String(result.id),
        meta: { domain_id, is_custom: !!is_custom, has_password: !!password, has_forward: !!forward_to },
        ip_address: req.ip,
      });

      reply.status(201);
      return {
        email: result.email,
        session_token: result.sessionToken,
        token,
        expires_at: result.expiresAt.toISOString(),
      };
    } catch (err: any) {
      this.log.log({
        actor_type: "user",
        action: "email.generate",
        status: "failure",
        meta: { domain_id },
        ip_address: req.ip,
        error: err?.message,
      });
      throw err;
    }
  }

  async login(req: FastifyRequest<{ Body: LoginBody }>, reply: FastifyReply) {
    const { email, password } = req.body;
    try {
      const account = await this.svc.login(email, password);

      const token = await reply.jwtSign(
        { sub: account.id, email: account.email, type: "user" },
        { expiresIn: env.JWT_EXPIRES_IN },
      );

      this.log.log({
        actor_type: "user",
        actor_id: account.id,
        actor_label: account.email,
        action: "email.login",
        resource_type: "account",
        resource_id: String(account.id),
        ip_address: req.ip,
      });

      return { token, email: account.email, session_token: account.sessionToken };
    } catch (err: any) {
      this.log.log({
        actor_type: "user",
        actor_label: email,
        action: "email.login",
        status: "failure",
        ip_address: req.ip,
        error: err?.message,
      });
      throw err;
    }
  }

  async inbox(
    req: FastifyRequest<{ Params: InboxParams; Querystring: InboxQuery }>,
    _reply: FastifyReply,
  ) {
    const account = await this.resolveAccount(req.params.token);
    const page  = req.query.page  ?? 1;
    const limit = req.query.limit ?? 20;
    const result = await this.svc.getInbox(account.id, page, limit);
    return {
      data: result.data,
      meta: { page: result.page, limit: result.limit, total: result.total, pages: result.pages },
    };
  }

  async message(req: FastifyRequest<{ Params: MessageParams }>, _reply: FastifyReply) {
    const account = await this.resolveAccount(req.params.token);
    const result = await this.svc.getMessage(account.id, req.params.messageId);
    this.log.log({
      actor_type: "user",
      actor_id: account.id,
      actor_label: account.email_address,
      action: "email.read_message",
      resource_type: "email",
      resource_id: req.params.messageId,
      ip_address: req.ip,
    });
    return result;
  }

  async deleteMessage(req: FastifyRequest<{ Params: MessageParams }>, reply: FastifyReply) {
    const account = await this.resolveAccount(req.params.token);
    try {
      await this.svc.deleteMessage(account.id, req.params.messageId);
      this.log.log({
        actor_type: "user",
        actor_id: account.id,
        actor_label: account.email_address,
        action: "email.delete_message",
        resource_type: "email",
        resource_id: req.params.messageId,
        ip_address: req.ip,
      });
      reply.status(204);
    } catch (err: any) {
      this.log.log({
        actor_type: "user",
        actor_id: account.id,
        actor_label: account.email_address,
        action: "email.delete_message",
        status: "failure",
        resource_type: "email",
        resource_id: req.params.messageId,
        ip_address: req.ip,
        error: err?.message,
      });
      throw err;
    }
  }

  async updateForward(
    req: FastifyRequest<{ Params: InboxParams; Body: UpdateForwardBody }>,
    _reply: FastifyReply,
  ) {
    const account = await this.resolveAccount(req.params.token);
    await this.svc.updateForward(req.params.token, req.body.forward_to);
    this.log.log({
      actor_type: "user",
      actor_id: account.id,
      actor_label: account.email_address,
      action: "email.update_forward",
      resource_type: "account",
      resource_id: String(account.id),
      meta: { forward_to: req.body.forward_to ?? null },
      ip_address: req.ip,
    });
    return { ok: true };
  }

  async deleteAccount(req: FastifyRequest<{ Params: InboxParams }>, reply: FastifyReply) {
    const account = await this.resolveAccount(req.params.token);
    try {
      await this.svc.deleteAccount(req.params.token);
      this.log.log({
        actor_type: "user",
        actor_id: account.id,
        actor_label: account.email_address,
        action: "email.delete_account",
        resource_type: "account",
        resource_id: String(account.id),
        ip_address: req.ip,
      });
      reply.status(204);
    } catch (err: any) {
      this.log.log({
        actor_type: "user",
        actor_id: account.id,
        actor_label: account.email_address,
        action: "email.delete_account",
        status: "failure",
        resource_type: "account",
        resource_id: String(account.id),
        ip_address: req.ip,
        error: err?.message,
      });
      throw err;
    }
  }

  private async resolveAccount(token: string) {
    const account = await this.svc.getAccountByToken(token);
    if (!account) {
      throw Object.assign(new Error("Invalid or expired session"), { statusCode: 401 });
    }
    return account;
  }
}
