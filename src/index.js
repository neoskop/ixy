import fastify from "fastify";
import { resizeRequestHandler } from "./resize-request-handler.js";
import { logger } from "./util/logger.js";

const app = fastify({
  logger,
});

app.get("/*", resizeRequestHandler);

app.listen({ port: 8080, host: "0.0.0.0" }).catch((err) => {
  console.error(err);
  process.exit(1);
});
