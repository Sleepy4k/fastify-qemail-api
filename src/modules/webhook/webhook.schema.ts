import { Type, type Static } from "@sinclair/typebox";

export const AttachmentItem = Type.Object({
  filename: Type.String(),
  path:     Type.String({ description: "data URI, HTTPS URL, atau raw base64" }),
  mimeType: Type.String(),
  size:     Type.Number({ minimum: 0, description: "Ukuran dalam bytes" }),
});
export type AttachmentItem = Static<typeof AttachmentItem>;

/**
 * Body webhook dari Cloudflare Worker.
 * `from` dan `to` TIDAK ada di body — diambil dari header HTTP:
 *   x-email-from  (fallback: "unknown")
 *   x-email-to    (fallback: "unknown")
 */
export const IncomingEmailBody = Type.Object({
  messageId:   Type.String(),
  subject:     Type.String(),
  text:        Type.Optional(Type.String()),
  html:        Type.Optional(Type.String()),
  attachments: Type.Optional(Type.Array(AttachmentItem)),
});
export type IncomingEmailBody = Static<typeof IncomingEmailBody>;

export const WebhookReply = Type.Object({
  ok: Type.Boolean(),
  id: Type.Optional(Type.Number()),
});

export const ForwardLookupQuery = Type.Object({
  to: Type.String(),
});
export type ForwardLookupQuery = Static<typeof ForwardLookupQuery>;

export const ForwardLookupReply = Type.Object({
  forward_to: Type.Union([Type.String(), Type.Null()]),
});
