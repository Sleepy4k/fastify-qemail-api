import { Type, type Static } from "@sinclair/typebox";

export const IncomingEmailBody = Type.Object({
  from: Type.String(),
  to: Type.String(),
  subject: Type.String(),
  text: Type.Optional(Type.String()),
  html: Type.Optional(Type.String()),
  headers: Type.Optional(Type.Record(Type.String(), Type.Unknown())),
  messageId: Type.String(),
  receivedAt: Type.String(),
});
export type IncomingEmailBody = Static<typeof IncomingEmailBody>;

export const WebhookReply = Type.Object({
  ok: Type.Boolean(),
  id: Type.Optional(Type.Number()),
});
