// jshint esversion: 8

const argv = require('./argv');
const path = require('path');
const tmp = require('tmp');
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
const {createLogger, format, transports} = require('winston');

let log_transports = [];

log_transports.push(new transports.Console({
  level: 'info',
  silent: argv.quiet,
}));

// apparently, querying of logs requires a file transport
let filename;
if (argv.output) {
  filename = path.join(argv.output, 'inspection-log.ndjson');
} else {
  filename = tmp.tmpNameSync({postfix: '-log.ndjson'});
}

log_transports.push(new transports.File({
  filename: filename,
  level: 'silly', // log everything to file
  options: { flags: 'w' } // overwrite instead of append, see https://github.com/winstonjs/winston/issues/1271
}));

const logger = createLogger({
  // https://stackoverflow.com/a/48573091/1407622
  format: format.combine(format.timestamp(), format.json()),
  transports: log_transports,
});

module.exports = logger;
