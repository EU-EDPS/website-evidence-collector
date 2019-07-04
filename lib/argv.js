// jshint esversion: 8

var argv = require('yargs') // TODO use rather option('o', hash) syntax and define default top-level command
  .scriptName('collect.js')
  .usage('Usage: $0 <URI> [options] [-- [Chrome options]]')
  .example('$0 https://example.com/about -b example.com -b cdn.ex.com')
  // top-level default command, see https://github.com/yargs/yargs/blob/master/docs/advanced.md#default-commands
  .demandCommand(1, 'An URI for inspection is mendatory.') // ask for command and for inspection url
  .alias('m', 'max')
  .nargs('m', 1)
  .describe('m', 'Sets maximum number of extra links for browsing')
  .default('m', 0)
  .number('m')

  // seeding is apparently not supported TODO
  // .alias('s', 'seed')
  // .nargs('s', 1)
  // .describe('s', 'Sets seed for random choice of links for browsing')
  // .number('m')

  .alias('s', 'sleep')
  .describe('s', 'Time to sleep after every page load in ms')
  .defaults('s', 3000) // 3 seconds default sleep
  .coerce('s', (arg) => {
    return arg == false ? 0 : Number(arg);
  })

  .alias('f', 'first-party-uri')
  .nargs('f', 1)
  .describe('f', 'First-party URIs for links and pages')
  .array('f')
  .default('f', [], '[<URI>]')

  .alias('l', 'browse-link')
  .nargs('l', 1)
  .describe('l', 'Adds URI to list of links for browsing')
  .array('l')

  .describe('headless', 'Hides the browser window')
  .boolean('headless')
  .default('headless', true)

  .alias('o', 'output')
  .describe('o', 'Output folder')
  // .nargs('o', 1)
  .default('o', './output')

  .alias('y', 'yaml')
  .describe('y', 'Output YAML to STDOUT')
  .boolean('y')
  .default('y', false)

  .alias('j', 'json')
  .describe('j', 'Output JSON to STDOUT')
  .boolean('j')
  .default('j', false)

  .alias('q', 'quiet')
  .describe('q', 'supress new line-determined JSON log to STDOUT')
  .boolean('q')
  .default('q', false)

  // .describe('mime-check', 'Excludes non-HTML pages from browsing')
  // .boolean('mime-check')
  // .default('mime-check', true)

  .describe('lang', 'Change the browser language')
  .default('lang', 'en')

  .help('h')
  .alias('h', 'help')
  .epilog('Copyright European Union 2019, licensed under EUPL-1.2 (see LICENSE.txt)')
  .argv;

  module.exports = argv;
