import type { FastifyRequest, FastifyReply } from "fastify";
import type { AdminService } from "./admin.service.ts";
import type {
  AdminLoginBody,
  CreateDomainBody,
  UpdateDomainBody,
  DomainIdParam,
  PaginationQuery,
  AccountIdParam,
  UpdateSettingBody,
} from "./admin.schema.ts";
import { env } from "../../config/env.ts";

export class AdminController {
  constructor(private svc: AdminService) {}

  async login(
    req: FastifyRequest<{ Body: AdminLoginBody }>,
    reply: FastifyReply,
  ) {
    const admin = await this.svc.login(req.body.username, req.body.password);
    const token = await reply.jwtSign(
      {
        sub: admin.id,
        username: admin.username,
        role: admin.role,
        type: "admin",
      },
      { expiresIn: env.ADMIN_JWT_EXPIRES_IN },
    );
    return { token, username: admin.username, role: admin.role };
  }

  async stats(_req: FastifyRequest, _reply: FastifyReply) {
    return this.svc.stats();
  }

  async listDomains(_req: FastifyRequest, _reply: FastifyReply) {
    return this.svc.listDomains();
  }

  async createDomain(
    req: FastifyRequest<{ Body: CreateDomainBody }>,
    reply: FastifyReply,
  ) {
    const id = await this.svc.createDomain(
      req.body.name,
      req.body.cloudflare_zone_id,
    );
    reply.status(201);
    return { id, name: req.body.name };
  }

  async updateDomain(
    req: FastifyRequest<{ Params: DomainIdParam; Body: UpdateDomainBody }>,
    _reply: FastifyReply,
  ) {
    await this.svc.updateDomain(req.params.id, req.body);
    return { ok: true };
  }

  async deleteDomain(
    req: FastifyRequest<{ Params: DomainIdParam }>,
    reply: FastifyReply,
  ) {
    await this.svc.deleteDomain(req.params.id);
    reply.status(204);
  }

  async listAccounts(
    req: FastifyRequest<{ Querystring: PaginationQuery }>,
    _reply: FastifyReply,
  ) {
    const { page = 1, limit = 20, search } = req.query;
    return this.svc.listAccounts(page, limit, search);
  }

  async inspectInbox(
    req: FastifyRequest<{
      Params: AccountIdParam;
      Querystring: PaginationQuery;
    }>,
    _reply: FastifyReply,
  ) {
    const { page = 1, limit = 20 } = req.query;
    return this.svc.inspectInbox(req.params.accountId, page, limit);
  }

  async deleteAccount(
    req: FastifyRequest<{ Params: AccountIdParam }>,
    reply: FastifyReply,
  ) {
    await this.svc.deleteAccount(req.params.accountId);
    reply.status(204);
  }

  async getDomainCfRules(
    req: FastifyRequest<{ Params: DomainIdParam }>,
    _reply: FastifyReply,
  ) {
    return this.svc.getDomainCfRules(req.params.id);
  }

  async getSettings(_req: FastifyRequest, _reply: FastifyReply) {
    return this.svc.getSettings();
  }

  async updateSetting(
    req: FastifyRequest<{ Body: UpdateSettingBody }>,
    _reply: FastifyReply,
  ) {
    await this.svc.upsertSetting(req.body.key, req.body.value);
    return { ok: true };
  }
}
