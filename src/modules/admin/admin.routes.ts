import type { FastifyInstance } from "fastify";
import { AdminService } from "./admin.service.ts";
import { AdminController } from "./admin.controller.ts";
import {
  AdminLoginBody,
  AdminLoginReply,
  CreateDomainBody,
  UpdateDomainBody,
  DomainIdParam,
  StatsReply,
  PaginationQuery,
  AccountIdParam,
  InboxMessageParam,
  UpdateSettingBody,
} from "./admin.schema.ts";

export async function adminRoutes(app: FastifyInstance) {
  const svc = new AdminService(app.db, app.redis);
  const ctrl = new AdminController(svc);

  app.post(
    "/login",
    {
      config: { rateLimit: { max: 5, timeWindow: "5 minutes" } },
      schema: {
        tags: ["admin"],
        summary: "Admin login",
        body: AdminLoginBody,
        response: { 200: AdminLoginReply },
      },
    },
    (req, reply) => ctrl.login(req as any, reply),
  );

  app.register(async (secured) => {
    secured.addHook("onRequest", secured.verifyAdmin);

    secured.get(
      "/stats",
      {
        schema: {
          tags: ["admin"],
          summary: "Dashboard stats",
          security: [{ bearer: [] }],
          response: { 200: StatsReply },
        },
      },
      (req, reply) => ctrl.stats(req, reply),
    );

    secured.get(
      "/domains",
      {
        schema: {
          tags: ["admin"],
          summary: "List all domains",
          security: [{ bearer: [] }],
        },
      },
      (req, reply) => ctrl.listDomains(req, reply),
    );

    secured.post(
      "/domains",
      {
        schema: {
          tags: ["admin"],
          summary: "Add domain",
          security: [{ bearer: [] }],
          body: CreateDomainBody,
        },
      },
      (req, reply) => ctrl.createDomain(req as any, reply),
    );

    secured.patch(
      "/domains/:id",
      {
        schema: {
          tags: ["admin"],
          summary: "Update domain",
          security: [{ bearer: [] }],
          params: DomainIdParam,
          body: UpdateDomainBody,
        },
      },
      (req, reply) => ctrl.updateDomain(req as any, reply),
    );

    secured.delete(
      "/domains/:id",
      {
        schema: {
          tags: ["admin"],
          summary: "Delete domain",
          security: [{ bearer: [] }],
          params: DomainIdParam,
        },
      },
      (req, reply) => ctrl.deleteDomain(req as any, reply),
    );

    secured.get(
      "/accounts",
      {
        schema: {
          tags: ["admin"],
          summary: "Browse accounts",
          security: [{ bearer: [] }],
          querystring: PaginationQuery,
        },
      },
      (req, reply) => ctrl.listAccounts(req as any, reply),
    );

    secured.get(
      "/accounts/:accountId/inbox",
      {
        schema: {
          tags: ["admin"],
          summary: "Inspect inbox",
          security: [{ bearer: [] }],
          params: AccountIdParam,
          querystring: PaginationQuery,
        },
      },
      (req, reply) => ctrl.inspectInbox(req as any, reply),
    );

    secured.get(
      "/accounts/:accountId/inbox/:messageId",
      {
        schema: {
          tags: ["admin"],
          summary: "Get inbox message detail",
          security: [{ bearer: [] }],
          params: InboxMessageParam,
        },
      },
      (req, reply) => ctrl.getInboxMessage(req as any, reply),
    );

    secured.delete(
      "/accounts/:accountId",
      {
        schema: {
          tags: ["admin"],
          summary: "Delete account and its Cloudflare routing rule",
          security: [{ bearer: [] }],
          params: AccountIdParam,
        },
      },
      (req, reply) => ctrl.deleteAccount(req as any, reply),
    );

    secured.get(
      "/domains/:id/cf-rules",
      {
        schema: {
          tags: ["admin"],
          summary: "List Cloudflare routing rules for domain",
          security: [{ bearer: [] }],
          params: DomainIdParam,
        },
      },
      (req, reply) => ctrl.getDomainCfRules(req as any, reply),
    );

    secured.get(
      "/settings",
      {
        schema: {
          tags: ["admin"],
          summary: "Get settings",
          security: [{ bearer: [] }],
        },
      },
      (req, reply) => ctrl.getSettings(req, reply),
    );

    secured.put(
      "/settings",
      {
        schema: {
          tags: ["admin"],
          summary: "Update setting",
          security: [{ bearer: [] }],
          body: UpdateSettingBody,
        },
      },
      (req, reply) => ctrl.updateSetting(req as any, reply),
    );
  });
}
