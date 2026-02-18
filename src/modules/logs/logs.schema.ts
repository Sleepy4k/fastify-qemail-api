import { Type, type Static } from "@sinclair/typebox";

export const LogsQuery = Type.Object({
  page: Type.Optional(Type.Number({ minimum: 1, default: 1 })),
  limit: Type.Optional(Type.Number({ minimum: 1, maximum: 100, default: 50 })),
  // filter
  actor_type: Type.Optional(
    Type.Union([
      Type.Literal("user"),
      Type.Literal("admin"),
      Type.Literal("system"),
    ]),
  ),
  action: Type.Optional(
    Type.String({
      description:
        "Prefix atau exact match, e.g. 'admin' atau 'email.generate'",
    }),
  ),
  status: Type.Optional(
    Type.Union([Type.Literal("success"), Type.Literal("failure")]),
  ),
  resource_type: Type.Optional(Type.String()),
  search: Type.Optional(
    Type.String({
      description: "Cari di actor_label, action, resource_id, ip_address",
    }),
  ),
  // sorting
  sort_by: Type.Optional(
    Type.Union([
      Type.Literal("created_at"),
      Type.Literal("action"),
      Type.Literal("actor_label"),
      Type.Literal("status"),
    ]),
  ),
  sort_dir: Type.Optional(
    Type.Union([Type.Literal("asc"), Type.Literal("desc")]),
  ),
});
export type LogsQuery = Static<typeof LogsQuery>;
