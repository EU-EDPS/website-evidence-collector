// jshint esversion: 8


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
const {createLogger, format, transports} = require('winston');

const logger = createLogger({
  // https://stackoverflow.com/a/48573091/1407622
  format: format.combine(format.timestamp(), format.json()),
  transports: [
    new transports.Console({level: 'info'}),
    new transports.File({
      filename: 'inspection-log.ndjson',
      level: 'silly', // log everything to file
      options: { flags: 'w' } // overwrite instead of append, see https://github.com/winstonjs/winston/issues/1271
    }),
  ]
});

module.exports = logger;
