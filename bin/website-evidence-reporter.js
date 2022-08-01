#!/usr/bin/env node
// jshint esversion: 8

/**
 * @file Produces an html output documenting evidence from websites on processed data in transit and at rest.
 * @author Robert Riemann <robert.riemann@edps.europa.eu>
 * @copyright European Data Protection Supervisor (2019)
 * @license EUPL-1.2
 *
 * @example while inotifywait -e modify assets/template.pug; do ./create-html.js output/inspection.json > output/inspection.html; done
 */

const fs = require("fs");
const path = require("path");
const pug = require("pug");
const yaml = require("js-yaml");
const unsafe = require('js-yaml-js-types').all;
yaml.DEFAULT_SCHEMA = yaml.DEFAULT_SCHEMA.extend(unsafe);

var argv = require("yargs") // TODO use rather option('o', hash) syntax and define default top-level command
  .scriptName("website-evidence-reporter")
  .usage("Usage: $0 <JSON file> [options]")
  .example("$0 /home/user/inspection.json")
  // allow for shell variables such as WEC_HTML_TEMPLATE=/path/to/template.pug
  .env("WEC")
  // top-level default command, see https://github.com/yargs/yargs/blob/master/docs/advanced.md#default-commands
  .demandCommand(1, "An input JSON file is mandatory.") // ask for command and for inspection url

  .describe("html-template", "Custom pug template to generate HTML output")
  .nargs("html-template", 1)
  .alias("html-template", "t")
  .string("html-template")



  .describe("extra-file", "Loads other JSON/YAML files in the template array 'extra'")
  .nargs("extra-file", 1)
  .alias("extra-file", "e")
  .array("extra-file")
  .coerce("extra-file", (files) => {
    return files.map( (file) => {
      if (file.toLowerCase().endsWith('.yaml') || file.toLowerCase().endsWith('.yml')) {
        return yaml.load(
          fs.readFileSync(file, "utf8")
        );
      } else {
        return JSON.parse(fs.readFileSync(file, "utf8"));
      }
    });
  })

  .describe("output-file", "Write HTML output to file instead to the screen")
  .nargs("output-file", 1)
  .alias("output-file", "o")
  .string("output-file")

  .help("help")
  .alias("h", "help")
  .epilog(
    "Copyright European Union 2019, licensed under EUPL-1.2 (see LICENSE.txt)"
  ).argv;

let output = JSON.parse(fs.readFileSync(argv._[0]));

let html_template =
  argv["html-template"] || path.join(__dirname, "../assets/template.pug");

let jsondir = path.relative(argv.outputFile ? path.dirname(argv.outputFile) : process.cwd(), path.dirname(argv._[0])); // path of the inspection.json

let html_dump = pug.renderFile(
  html_template,
  Object.assign({}, output, {
    pretty: true,
    basedir: path.resolve(path.join(__dirname, '../assets')), // determines root director for pug
    jsondir: jsondir || ".",
    // expose some libraries to pug templates
    groupBy: require("lodash/groupBy"),
    marked: require("marked"),
    fs: fs,
    yaml: yaml,
    path: path,
    inlineCSS: fs.readFileSync(
      require.resolve("github-markdown-css/github-markdown.css")
    ),
    inspection: output,
    extra: argv.extraFile
  })
);

if (argv.outputFile) {
  fs.writeFileSync(path.join(argv.outputFile), html_dump);
} else {
  console.log(html_dump);
}
