import { buildApp } from "./app.ts";

async function main() {
  const app = await buildApp();

  try {
    await app.listen({ host: app.config.HOST, port: app.config.PORT });
    app.log.info(`Server listening on http://${app.config.HOST}:${app.config.PORT}`);
    app.log.info(`Swagger docs at http://${app.config.HOST}:${app.config.PORT}/docs`);
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }

  const signals: NodeJS.Signals[] = ["SIGINT", "SIGTERM"];
  for (const signal of signals) {
    process.on(signal, async () => {
      app.log.info(`Received ${signal}, closing gracefully...`);
      await app.close();
      process.exit(0);
    });
  }
}

main();

