import type { FastifyInstance } from "fastify";
import { AttachmentsService } from "./attachments.service.ts";
import { AttachmentsController } from "./attachments.controller.ts";
import { FileParams, NotFoundReply } from "./attachments.schema.ts";

export async function attachmentsRoutes(app: FastifyInstance) {
  const svc = new AttachmentsService(app.db);
  const ctrl = new AttachmentsController(svc);

  app.get(
    "/:storedName",
    {
      schema: {
        tags: ["files"],
        summary: "Serve attachment file",
        params: FileParams,
        response: { 404: NotFoundReply },
      },
    },
    (req, reply) => ctrl.serveFile(req as any, reply),
  );
}
