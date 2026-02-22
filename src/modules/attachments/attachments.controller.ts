import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import { join } from "node:path";
import type { FastifyRequest, FastifyReply } from "fastify";
import type { AttachmentsService } from "./attachments.service.ts";
import type { FileParams } from "./attachments.schema.ts";
import { STORED_NAME_RE } from "./attachments.schema.ts";

export class AttachmentsController {
  constructor(
    private svc: AttachmentsService,
    private uploadDir: string,
  ) {}

  async serveFile(
    req: FastifyRequest<{ Params: FileParams }>,
    reply: FastifyReply,
  ) {
    const { storedName } = req.params;

    if (!STORED_NAME_RE.test(storedName)) {
      return reply.status(404).send({ message: "Not found" });
    }

    const attachment = await this.svc.findByStoredName(storedName);
    if (!attachment) {
      return reply.status(404).send({ message: "Not found" });
    }

    const filePath = join(this.uploadDir, storedName);
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
  }
}
