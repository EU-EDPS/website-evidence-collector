/**
 * @file Setup logger
 * @author Robert Riemann <robert.riemann@edps.europa.eu>
 * @copyright European Data Protection Supervisor (2019)
 * @license EUPL-1.2
 */

// jshint esversion: 8

const path = require("path");
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

const create = function (options, args = {}) {
  const defaults = {
    console: {
      silent: false,
      level: "debug",
      stderrLevels: ['error', 'debug', 'info', 'warn'],
      format: process.stdout.isTTY ? format.combine(format.colorize(), format.simple()) : format.json(),
    },

    file: {
      enabled: true,
      level: "silly",
      format: format.json(),
    },
  };

  const config = { ...defaults, ...options };

  const logger = createLogger({
    // https://stackoverflow.com/a/48573091/1407622
    format: format.combine(format.timestamp()),
    transports: [
      new transports.Console({
        level: config.console.level,
        silent: config.console.silent,
        stderrLevels: config.console.stderrLevels,
        format: config.console.format,
      }),
    ],
  });

  if (config.file.enabled) {
    let filename;
    if (args.output) {
      filename = path.join(args.output, "inspection-log.ndjson");
    } else {
      filename = tmp.tmpNameSync({ postfix: "-log.ndjson" });
    }
    logger.add(
      new transports.File({
        filename: filename,
        level: config.file.level, // log everything to file
        format: config.file.format,
      })
    );
  }

  return logger;
};

module.exports = { create };
