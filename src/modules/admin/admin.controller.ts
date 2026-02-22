import type { FastifyRequest, FastifyReply } from "fastify";
import type { AdminService } from "./admin.service.ts";
import type { LogService } from "../../utils/log-service.ts";
import type {
  AdminLoginBody,
  CreateDomainBody,
  UpdateDomainBody,
  DomainIdParam,
  PaginationQuery,
  AccountIdParam,
  InboxMessageParam,
  UpdateSettingBody,
} from "./admin.schema.ts";

export class AdminController {
  constructor(
    private svc: AdminService,
    private log: LogService,
    private adminJwtExpiresIn: string,
  ) {}

  async login(
    req: FastifyRequest<{ Body: AdminLoginBody }>,
    reply: FastifyReply,
  ) {
    try {
      const admin = await this.svc.login(req.body.username, req.body.password);
      const token = await reply.jwtSign(
        {
          sub: admin.id,
          username: admin.username,
          role: admin.role,
          type: "admin",
        },
        { expiresIn: this.adminJwtExpiresIn },
      );
      this.log.log({
        actor_type: "admin",
        actor_id: admin.id,
        actor_label: admin.username,
        action: "admin.login",
        ip_address: req.ip,
      });
      return { token, username: admin.username, role: admin.role };
    } catch (err: any) {
      this.log.log({
        actor_type: "admin",
        actor_label: req.body.username,
        action: "admin.login",
        status: "failure",
        ip_address: req.ip,
        error: err?.message,
      });
      throw err;
    }
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
    const admin = req.user as any;
    const {
      name,
      cloudflare_zone_id,
      cf_api_token,
      cf_account_id,
      cf_worker_name,
    } = req.body;
    try {
      const id = await this.svc.createDomain(name, cloudflare_zone_id, {
        cf_api_token,
        cf_account_id,
        cf_worker_name,
      });
      this.log.log({
        actor_type: "admin",
        actor_id: admin?.sub,
        actor_label: admin?.username,
        action: "admin.domain.create",
        resource_type: "domain",
        resource_id: String(id),
        meta: {
          name,
          has_zone_id: !!cloudflare_zone_id,
          has_cf_token: !!cf_api_token,
        },
        ip_address: req.ip,
      });
      reply.status(201);
      return { id, name };
    } catch (err: any) {
      this.log.log({
        actor_type: "admin",
        actor_id: admin?.sub,
        actor_label: admin?.username,
        action: "admin.domain.create",
        status: "failure",
        resource_type: "domain",
        meta: { name },
        ip_address: req.ip,
        error: err?.message,
      });
      throw err;
    }
  }

  async updateDomain(
    req: FastifyRequest<{ Params: DomainIdParam; Body: UpdateDomainBody }>,
    _reply: FastifyReply,
  ) {
    const admin = req.user as any;
    try {
      await this.svc.updateDomain(req.params.id, req.body);
      this.log.log({
        actor_type: "admin",
        actor_id: admin?.sub,
        actor_label: admin?.username,
        action: "admin.domain.update",
        resource_type: "domain",
        resource_id: String(req.params.id),
        meta: { changes: req.body },
        ip_address: req.ip,
      });
      return { ok: true };
    } catch (err: any) {
      this.log.log({
        actor_type: "admin",
        actor_id: admin?.sub,
        actor_label: admin?.username,
        action: "admin.domain.update",
        status: "failure",
        resource_type: "domain",
        resource_id: String(req.params.id),
        ip_address: req.ip,
        error: err?.message,
      });
      throw err;
    }
  }

  async deleteDomain(
    req: FastifyRequest<{ Params: DomainIdParam }>,
    reply: FastifyReply,
  ) {
    const admin = req.user as any;
    try {
      await this.svc.deleteDomain(req.params.id);
      this.log.log({
        actor_type: "admin",
        actor_id: admin?.sub,
        actor_label: admin?.username,
        action: "admin.domain.delete",
        resource_type: "domain",
        resource_id: String(req.params.id),
        ip_address: req.ip,
      });
      reply.status(204);
    } catch (err: any) {
      this.log.log({
        actor_type: "admin",
        actor_id: admin?.sub,
        actor_label: admin?.username,
        action: "admin.domain.delete",
        status: "failure",
        resource_type: "domain",
        resource_id: String(req.params.id),
        ip_address: req.ip,
        error: err?.message,
      });
      throw err;
    }
  }

  async listAccounts(
    req: FastifyRequest<{ Querystring: PaginationQuery }>,
    _reply: FastifyReply,
  ) {
    const { page = 1, limit = 20, search, domain_id, is_custom } = req.query;
    return this.svc.listAccounts(page, limit, search, domain_id, is_custom);
  }

  async inspectInbox(
    req: FastifyRequest<{
      Params: AccountIdParam;
      Querystring: PaginationQuery;
    }>,
    _reply: FastifyReply,
  ) {
    const admin = req.user as any;
    const { page = 1, limit = 20 } = req.query;
    const result = await this.svc.inspectInbox(
      req.params.accountId,
      page,
      limit,
    );
    this.log.log({
      actor_type: "admin",
      actor_id: admin?.sub,
      actor_label: admin?.username,
      action: "admin.account.inspect_inbox",
      resource_type: "account",
      resource_id: String(req.params.accountId),
      meta: { page, limit },
      ip_address: req.ip,
    });
    return result;
  }

  async getInboxMessage(
    req: FastifyRequest<{ Params: InboxMessageParam }>,
    _reply: FastifyReply,
  ) {
    const admin = req.user as any;
    const result = await this.svc.getInboxMessage(
      req.params.accountId,
      req.params.messageId,
    );
    this.log.log({
      actor_type: "admin",
      actor_id: admin?.sub,
      actor_label: admin?.username,
      action: "admin.account.read_message",
      resource_type: "email",
      resource_id: req.params.messageId,
      meta: { account_id: req.params.accountId },
      ip_address: req.ip,
    });
    return result;
  }

  async deleteAccount(
    req: FastifyRequest<{ Params: AccountIdParam }>,
    reply: FastifyReply,
  ) {
    const admin = req.user as any;
    try {
      await this.svc.deleteAccount(req.params.accountId);
      this.log.log({
        actor_type: "admin",
        actor_id: admin?.sub,
        actor_label: admin?.username,
        action: "admin.account.delete",
        resource_type: "account",
        resource_id: String(req.params.accountId),
        ip_address: req.ip,
      });
      reply.status(204);
    } catch (err: any) {
      this.log.log({
        actor_type: "admin",
        actor_id: admin?.sub,
        actor_label: admin?.username,
        action: "admin.account.delete",
        status: "failure",
        resource_type: "account",
        resource_id: String(req.params.accountId),
        ip_address: req.ip,
        error: err?.message,
      });
      throw err;
    }
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
    const admin = req.user as any;
    try {
      await this.svc.upsertSetting(req.body.key, req.body.value);
      this.log.log({
        actor_type: "admin",
        actor_id: admin?.sub,
        actor_label: admin?.username,
        action: "admin.settings.update",
        resource_type: "setting",
        resource_id: req.body.key,
        meta: { key: req.body.key, value: req.body.value },
        ip_address: req.ip,
      });
      return { ok: true };
    } catch (err: any) {
      this.log.log({
        actor_type: "admin",
        actor_id: admin?.sub,
        actor_label: admin?.username,
        action: "admin.settings.update",
        status: "failure",
        resource_type: "setting",
        resource_id: req.body.key,
        ip_address: req.ip,
        error: err?.message,
      });
      throw err;
    }
  }
}
