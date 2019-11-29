/**
 * @file Setup command line arguments
 * @author Robert Riemann <robert.riemann@edps.europa.eu>
 * @copyright European Data Protection Supervisor (2019)
 * @license EUPL-1.2
 */

// jshint esversion: 8

var argv = require('yargs') // TODO use rather option('o', hash) syntax and define default top-level command
  .scriptName('website-evidence-collector')
  .usage('Usage: $0 <URI> [options] [-- [Chrome options]]')
  .example('$0 https://example.com/about -f https://example.com -b https://cdn.ex.com')
  // top-level default command, see https://github.com/yargs/yargs/blob/master/docs/advanced.md#default-commands
  .demandCommand(1, 'An URI for inspection is mandatory.') // ask for command and for inspection url
  .alias('m', 'max')
  .nargs('m', 1)
  .describe('m', 'Sets maximum number of extra links for browsing')
  .default('m', 0)
  .number('m')

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

  .alias('h', 'html')
  .describe('h', 'Ouput HTML to STDOUT')
  .boolean('h')
  .default('h', false)

  .describe('html-template', 'Custom pug template to generate HTML')
  .nargs('html-template', 1)

  .alias('t', 'title')
  .describe('t', 'Title of the collection for display in output')
  .nargs('t', 1)

  .alias('q', 'quiet')
  .describe('q', 'supress new line-determined JSON log to STDOUT')
  .boolean('q')
  .default('q', false)

  .describe('testssl', 'call testssl.sh executable and integrate its output')
  .default('testssl', 'testssl.sh')
  .conflicts('testssl', 'testssl-file')

  .describe('testssl-file', 'include [JSON FILE] from TestSSL.sh in output')
  .string('testssl-file')
  .nargs('testssl-file', 1)
  .conflicts('testssl-file', 'testssl')

  // .describe('mime-check', 'Excludes non-HTML pages from browsing')
  // .boolean('mime-check')
  // .default('mime-check', true)

  .describe('lang', 'Change the browser language')
  .default('lang', 'en')

  .help('help')
  .epilog('Copyright European Union 2019, licensed under EUPL-1.2 (see LICENSE.txt)')
  .argv;

  module.exports = argv;
