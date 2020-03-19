#!/usr/bin/env node
// jshint esversion: 8

/**
 * @file Collects evidence from websites on processed data in transit and at rest.
 * @author Robert Riemann <robert.riemann@edps.europa.eu>
 * @copyright European Data Protection Supervisor (2019)
 * @license EUPL-1.2
 *
 * @example while inotifywait -e modify assets/template.pug; do ./create-html.js output/inspection.json > output/inspection.html; done
 */

const fs = require('fs');
const path = require('path');
const pug = require('pug');

var argv = require('yargs') // TODO use rather option('o', hash) syntax and define default top-level command
  .scriptName('website-evidence-reporter')
  .usage('Usage: $0 <JSON file> [options]')
  .example('$0 /home/user/inspection.json')
  // top-level default command, see https://github.com/yargs/yargs/blob/master/docs/advanced.md#default-commands
  .demandCommand(1, 'An input JSON file is mandatory.') // ask for command and for inspection url

  .describe('html-template', 'Custom pug template to generate HTML output')
  .nargs('html-template', 1)
  .alias('html-template', 't')
  .string('html-template')


  .describe('output', 'Write HTML output to file instead to the screen')
  .nargs('output', 1)
  .alias('output', 'o')
  .string('output')

  .help('help')
  .alias('h', 'help')
  .epilog('Copyright European Union 2019, licensed under EUPL-1.2 (see LICENSE.txt)')
  .argv;
  
let output = JSON.parse(fs.readFileSync(argv._[0]));

let html_template = argv.htmlTemplate || path.join(__dirname, 'assets/template.pug');

let html_dump = pug.renderFile(html_template, Object.assign({}, output, {
  pretty: true,
  basedir: __dirname,
  groupBy: require('lodash/groupBy'),
}));

if (argv.output) {
  fs.writeFileSync(path.join(argv.output), html_dump);
} else {
  console.log(html_dump);
}
