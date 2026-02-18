import { Type, type Static } from "@sinclair/typebox";

export const GenerateBody = Type.Object({
  domain_id: Type.Number({ minimum: 1 }),
  username: Type.Optional(
    Type.String({ minLength: 3, maxLength: 30, pattern: "^[a-zA-Z0-9._-]+$" }),
  ),
  password: Type.Optional(Type.String({ minLength: 8, maxLength: 128 })),
  is_custom: Type.Optional(Type.Boolean()),
  forward_to: Type.Optional(Type.String({ format: "email" })),
});
export type GenerateBody = Static<typeof GenerateBody>;

export const GenerateReply = Type.Object({
  email: Type.String(),
  session_token: Type.String(),
  token: Type.Union([Type.String(), Type.Null()]),
  expires_at: Type.String(),
});

export const LoginBody = Type.Object({
  email: Type.String({ format: "email" }),
  password: Type.String(),
});
export type LoginBody = Static<typeof LoginBody>;

export const LoginReply = Type.Object({
  token: Type.String(),
  email: Type.String(),
  session_token: Type.String(),
});

export const InboxParams = Type.Object({
  token: Type.String({ minLength: 10 }),
});
export type InboxParams = Static<typeof InboxParams>;

export const InboxQuery = Type.Object({
  page: Type.Optional(Type.Number({ minimum: 1, default: 1 })),
  limit: Type.Optional(Type.Number({ minimum: 1, maximum: 100, default: 20 })),
});
export type InboxQuery = Static<typeof InboxQuery>;

export const MessageParams = Type.Object({
  token: Type.String({ minLength: 10 }),
  messageId: Type.String(),
});
export type MessageParams = Static<typeof MessageParams>;

export const DomainItem = Type.Object({
  id: Type.Number(),
  name: Type.String(),
});

export const UpdateForwardBody = Type.Object({
  forward_to: Type.Union([Type.String({ format: "email" }), Type.Null()]),
});
export type UpdateForwardBody = Static<typeof UpdateForwardBody>;
