import { createLogger, format, transports, config } from "winston";
import chalk from "chalk";

export const logger = createLogger({
  level: process.env.DEBUG === "true" ? "debug" : "info",
  format: format.combine(
    format.printf((info) => {
      if (typeof info.message === "object") {
        info.message = info.message.req
          ? `Request ${chalk.bold(info.reqId)}: ${chalk.bold(
              info.message.req.method
            )} ${info.message.req.url} (Request ID ${info.reqId})`
          : `Response to ${chalk.bold(info.reqId)}: ${
              info.message.res.statusCode
            } (${chalk.bold(info.message.responseTime.toFixed(2))}ms)`;
        delete info.reqId;
      }

      return info.message;
    }),
    format.colorize(),
    format.simple()
  ),
  levels: {
    fatal: 0,
    warn: 4,
    trace: 7,
    ...config.syslog.levels,
  },
  transports: [
    new transports.Console({
      format: format.simple(),
    }),
  ],
});
