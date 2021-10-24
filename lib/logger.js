/**
 * @file Setup logger
 * @author Robert Riemann <robert.riemann@edps.europa.eu>
 * @copyright European Data Protection Supervisor (2019)
 * @license EUPL-1.2
 */

// jshint esversion: 8

const tmp = require("tmp");
tmp.setGracefulCleanup();

// Levels:
// {
//   error: 0,
//   warn: 1,
//   info: 2,
//   verbose: 3,
//   debug: 4,
//   silly: 5
// }

// https://stackoverflow.com/a/45211015/1407622
const { createLogger, format, transports } = require("winston");

const create = function (options) {
  const defaults = {
    console: {
      silent: false,
      level: "debug",
    },

    file: {
      enabled: true,
      level: "silly",
    },
  };

  const config = { ...defaults, ...options };

  const logger = createLogger({
    // https://stackoverflow.com/a/48573091/1407622
    format: format.combine(format.timestamp(), format.json()),
    transports: [
      new transports.Console({
        level: config.console.level,
        silent: config.console.silent,
        format: format.combine(format.colorize(), format.simple()),
      }),
    ],
  });

  if (config.file.enabled) {
    let filename = tmp.tmpNameSync({ postfix: "-log.ndjson" });
    logger.add(
      new transports.File({
        filename: filename,
        level: config.file.level, // log everything to file
      })
    );
  }

  return logger;
};

module.exports = { create };
