import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import { join } from "node:path";
import type { FastifyInstance } from "fastify";
import { Type } from "@sinclair/typebox";
import type { AttachmentRow } from "../../types/index.ts";
import { env } from "../../config/env.ts";

// stored_name pattern: 32 hex chars + optional extension (e.g. .jpg, .pdf)
const STORED_NAME_RE = /^[0-9a-f]{32}(\.[a-zA-Z0-9]{1,10})?$/;

export async function attachmentsRoutes(app: FastifyInstance) {
  app.get(
    "/:storedName",
    {
      schema: {
        tags: ["files"],
        summary: "Serve attachment file",
        params: Type.Object({ storedName: Type.String() }),
        response: {
          404: Type.Object({ message: Type.String() }),
        },
      },
    },
    async (req, reply) => {
      const { storedName } = req.params as { storedName: string };

      if (!STORED_NAME_RE.test(storedName)) {
        return reply.status(404).send({ message: "Not found" });
      }

      const [rows] = await app.db.query<AttachmentRow[]>(
        "SELECT mime_type, original_filename FROM email_attachments WHERE stored_name = ?",
        [storedName],
      );
      const attachment = rows[0];
      if (!attachment) {
        return reply.status(404).send({ message: "Not found" });
      }

      const filePath = join(env.UPLOAD_DIR, storedName);
      try {
        await stat(filePath);
      } catch {
        return reply.status(404).send({ message: "Not found" });
      }

      const stream = createReadStream(filePath);
      reply.type(attachment.mime_type);
      reply.header(
        "Content-Disposition",
        `inline; filename="${attachment.original_filename.replace(/"/g, "_")}"`,
      );
      return reply.send(stream);
    },
  );
}
