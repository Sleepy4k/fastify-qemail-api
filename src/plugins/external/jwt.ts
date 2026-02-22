import fp from "fastify-plugin";
import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import jwt from "@fastify/jwt";
import cookie from "@fastify/cookie";
import type { UserPayload, AdminPayload } from "../../types/index.ts";

export default fp(
  async function jwtPlugin(app: FastifyInstance) {
    await app.register(cookie, { secret: app.config.SESSION_SECRET });

    await app.register(jwt, {
      secret: app.config.JWT_SECRET,
      sign: { expiresIn: app.config.JWT_EXPIRES_IN },
    });

    app.decorate(
      "verifyUser",
      async function (request: FastifyRequest, _reply: FastifyReply) {
        const decoded = await request.jwtVerify<UserPayload>();
        if (decoded.type !== "user") {
          throw Object.assign(new Error("Invalid token type"), {
            statusCode: 401,
          });
        }
        request.user = decoded;
      },
    );

    app.decorate(
      "verifyAdmin",
      async function (request: FastifyRequest, _reply: FastifyReply) {
        const decoded = await request.jwtVerify<AdminPayload>();
        if (decoded.type !== "admin") {
          throw Object.assign(new Error("Admin access required"), {
            statusCode: 401,
          });
        }
        request.admin = decoded;
      },
    );
  },
  { name: "jwt", dependencies: ["env"] },
);
