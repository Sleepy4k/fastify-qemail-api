import type { FastifyRequest, FastifyReply } from "fastify";
import type { EmailService } from "./email.service.ts";
import type {
  GenerateBody,
  LoginBody,
  InboxParams,
  InboxQuery,
  MessageParams,
} from "./email.schema.ts";
import { env } from "../../config/env.ts";

export class EmailController {
  constructor(private svc: EmailService) {}

  async domains(_req: FastifyRequest, _reply: FastifyReply) {
    return this.svc.getActiveDomains();
  }

  async generate(
    req: FastifyRequest<{ Body: GenerateBody }>,
    reply: FastifyReply,
  ) {
    const { domain_id, username, password } = req.body;
    const result = await this.svc.generate(
      domain_id,
      username,
      password,
      req.ip,
    );

    let token = null;
    if (password) {
      token = await reply.jwtSign(
        { sub: result.id, email: result.email, type: "user" },
        { expiresIn: env.JWT_EXPIRES_IN },
      );
    }

    reply.status(201);
    return {
      email: result.email,
      session_token: result.sessionToken,
      token,
      expires_at: result.expiresAt.toISOString(),
    };
  }

  async login(req: FastifyRequest<{ Body: LoginBody }>, reply: FastifyReply) {
    const { email, password } = req.body;
    const account = await this.svc.login(email, password);

    const token = await reply.jwtSign(
      { sub: account.id, email: account.email, type: "user" },
      { expiresIn: env.JWT_EXPIRES_IN },
    );

    return { token, email: account.email, session_token: account.sessionToken };
  }

  async inbox(
    req: FastifyRequest<{ Params: InboxParams; Querystring: InboxQuery }>,
    _reply: FastifyReply,
  ) {
    const account = await this.resolveAccount(req.params.token, req);
    const page = req.query.page ?? 1;
    const limit = req.query.limit ?? 20;

    const result = await this.svc.getInbox(account.id, page, limit);
    return {
      data: result.data,
      meta: {
        page: result.page,
        limit: result.limit,
        total: result.total,
        pages: result.pages,
      },
    };
  }

  async message(
    req: FastifyRequest<{ Params: MessageParams }>,
    _reply: FastifyReply,
  ) {
    const account = await this.resolveAccount(req.params.token, req);
    return this.svc.getMessage(account.id, req.params.messageId);
  }

  async deleteMessage(
    req: FastifyRequest<{ Params: MessageParams }>,
    reply: FastifyReply,
  ) {
    const account = await this.resolveAccount(req.params.token, req);
    await this.svc.deleteMessage(account.id, req.params.messageId);
    reply.status(204);
  }

  async deleteAccount(
    req: FastifyRequest<{ Params: InboxParams }>,
    reply: FastifyReply,
  ) {
    await this.svc.deleteAccount(req.params.token);
    reply.status(204);
  }

  private async resolveAccount(token: string, _req: FastifyRequest) {
    const account = await this.svc.getAccountByToken(token);
    if (!account) {
      throw Object.assign(new Error("Invalid or expired session"), {
        statusCode: 401,
      });
    }
    return account;
  }
}
