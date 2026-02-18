import { Type, type Static } from "@sinclair/typebox";

export const AdminLoginBody = Type.Object({
  username: Type.String(),
  password: Type.String(),
});
export type AdminLoginBody = Static<typeof AdminLoginBody>;

export const AdminLoginReply = Type.Object({
  token: Type.String(),
  username: Type.String(),
  role: Type.String(),
});

export const CreateDomainBody = Type.Object({
  name: Type.String(),
  cloudflare_zone_id: Type.Optional(Type.String()),
});
export type CreateDomainBody = Static<typeof CreateDomainBody>;

export const UpdateDomainBody = Type.Object({
  is_active: Type.Optional(Type.Boolean()),
  cloudflare_zone_id: Type.Optional(Type.String()),
});
export type UpdateDomainBody = Static<typeof UpdateDomainBody>;

export const DomainIdParam = Type.Object({
  id: Type.Number(),
});
export type DomainIdParam = Static<typeof DomainIdParam>;

export const StatsReply = Type.Object({
  total_accounts: Type.Number(),
  total_emails: Type.Number(),
  total_domains: Type.Number(),
  active_accounts: Type.Number(),
});

export const UpdateSettingBody = Type.Object({
  key: Type.String(),
  value: Type.String(),
});
export type UpdateSettingBody = Static<typeof UpdateSettingBody>;

export const PaginationQuery = Type.Object({
  page: Type.Optional(Type.Number({ minimum: 1, default: 1 })),
  limit: Type.Optional(Type.Number({ minimum: 1, maximum: 100, default: 20 })),
  search: Type.Optional(Type.String()),
});
export type PaginationQuery = Static<typeof PaginationQuery>;

export const AccountIdParam = Type.Object({
  accountId: Type.Number(),
});
export type AccountIdParam = Static<typeof AccountIdParam>;
