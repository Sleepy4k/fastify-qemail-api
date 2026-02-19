import { Type, type Static } from "@sinclair/typebox";

export const STORED_NAME_RE = /^[0-9a-f]{32}(\.[a-zA-Z0-9]{1,10})?$/;

export const FileParams = Type.Object({
  storedName: Type.String(),
});
export type FileParams = Static<typeof FileParams>;

export const NotFoundReply = Type.Object({
  message: Type.String(),
});
