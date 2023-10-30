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
const HTMLtoDOCX = require("html-to-docx");
const puppeteer = require("puppeteer");
const { spawnSync } = require('node:child_process');
const yaml = require("js-yaml");
const unsafe = require('js-yaml-js-types').all;
yaml.DEFAULT_SCHEMA = yaml.DEFAULT_SCHEMA.extend(unsafe);

var argv = require("yargs") // TODO use rather option('o', hash) syntax and define default top-level command
  .scriptName("website-evidence-reporter")
  .usage("Usage: $0 [options] <JSON file>")
  .example("$0 /home/user/inspection.json")
  // allow for shell variables such as WEC_HTML_TEMPLATE=/path/to/template.pug
  .env("WEC")
  // top-level default command, see https://github.com/yargs/yargs/blob/master/docs/advanced.md#default-commands
  .demandCommand(1, "An input JSON file is mandatory.") // ask for command and for inspection url

  .describe("html-template", "Custom pug template to generate HTML output")
  .nargs("html-template", 1)
  .alias("html-template", "t")
  .string("html-template")

  .describe("office-template", "Custom pug template to generate DOCX with NPM html-to-docx or DOCX/ODT with pandoc")
  .nargs("office-template", 1)
  .string("office-template")
  
  .describe("use-pandoc", "Conversion to DOCX/ODT with pandoc instead of NPM")
  .boolean("use-pandoc")
  .default("use-pandoc", false)
  
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

  .describe("output-file", "Write HTML/PDF/DOCX/ODT output to file according to file extension")
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
let office_template =
  argv["office-template"] || path.join(__dirname, "../assets/template-office.pug");

let jsondir = path.relative(argv.outputFile ? path.dirname(argv.outputFile) : process.cwd(), path.dirname(argv._[0])); // path of the inspection.json

const marked = require('marked');
// it is surprising that https://github.com/jstransformers/jstransformer-marked picks up this object (undocumented API)
// source of this call: https://github.com/markedjs/marked-custom-heading-id/blob/main/src/index.js (MIT License, Copyright (c) 2021 @markedjs)
marked.use({renderer: {
      heading(text, level, raw, slugger) {
        // WEC patch: add \:
        const headingIdRegex = /(?: +|^)\{#([a-z][\:\w-]*)\}(?: +|$)/i;
        const hasId = text.match(headingIdRegex);
        if (!hasId) {
          // fallback to original heading renderer
          return false;
        }
        return `<h${level} id="${hasId[1]}">${text.replace(headingIdRegex, '')}</h${level}>\n`;
      }
}});
marked.use(require('marked-smartypants').markedSmartypants());

const make_office = argv.outputFile && (argv.outputFile.endsWith(".docx") || argv.outputFile.endsWith(".odt"));
const make_pdf = argv.outputFile && argv.outputFile.endsWith(".pdf");

let html_dump = pug.renderFile(
  make_office ? office_template : html_template,
  Object.assign({}, output, {
    pretty: true,
    basedir: path.resolve(path.join(__dirname, '../assets')), // determines root director for pug
    jsondir: jsondir || ".",
    // expose some libraries to pug templates
    groupBy: require("lodash/groupBy"),
    marked: marked, // we need to pass the markdown engine to template for access at render-time (as opposed to comile time), see https://github.com/pugjs/pug/issues/1171
    fs: fs,
    yaml: yaml,
    path: path,
    inlineCSS: fs.readFileSync(
      require.resolve("github-markdown-css/github-markdown.css")
    ),
    inspection: output,
    extra: argv.extraFile,
    filterOptions: {marked: {}},
  })
);

if (argv.outputFile) {
  if(make_office) {
    if(argv.usePandoc) {
      // console.warn("Using pandoc to generate", argv.outputFile);
      // pandoc infers the output format from the output file name
      let ret = spawnSync('pandoc', ['-f', 'html', '--number-sections', '--toc', '--output', argv.outputFile], {
        // cwd: '.',
        input: html_dump,
        encoding: 'utf8',
      });
      if(ret[2]) {
        console.log(ret[2]);
      }
    } else {
      if(argv.outputFile.endsWith(".odt")) {
        console.error("To generate .odt, you must have pandoc installed and specify --use-pandoc.");
        process.exit(1);
      }
      
      // console.warn("Using NPM html-to-docx to generate", argv.outputFile);
      const documentOptions = {
        // decodeUnicode: true,
        orientation: "portrait",
        pageSize: {width: "21.0cm", height: "29.7cm"},
        pageNumber: true,
        // lineNumber: true,
        // lineNumberOptions: {countBy: 5},
        title: output.title,
        lang: "en-UK",
        creator: `EDPS Website Evidence Collector v${output.script.version.npm} using NPM html-to-docx`,
      };
      HTMLtoDOCX(html_dump, null, documentOptions, null).then(fileBuffer => {
        fs.writeFileSync(path.join(argv.outputFile), fileBuffer);
      }).catch(err => {console.error(err);});
    }
  } else {
    if(make_pdf) {
      (async () => {
        const browser = await puppeteer.launch({
          // https://developer.chrome.com/articles/new-headless/.
          headless: 'new',
        });
        const pages = await browser.pages();
        await pages[0].setContent(html_dump);
        await pages[0].pdf({
          path: path.resolve(path.join(argv.outputFile)),
          format: 'A4',
          displayHeaderFooter: true,
          headerTemplate: `
            <div class="page-footer" style="width: 100%; font-size: 11px; padding: 5px 5px 0; position: relative;">
                <div style="bottom: 5px; text-align: center;"><span class="title"></span></div>
            </div>
          `,
          footerTemplate: `
            <div class="page-header" style="width: 100%; font-size: 11px; padding: 5px 5px 0; position: relative;">
                <div style="top: 5px; text-align: center;"><span class="pageNumber"></span>/<span class="totalPages"></span></div>
            </div>
          `,
          // this is needed to prevent content from being placed over the footer
          margin: { top: '1.5cm', bottom: '1cm' },
        })
        await browser.close();
      })();
    } else {
      fs.writeFileSync(path.join(argv.outputFile), html_dump);
    }
  }
} else {
  console.log(html_dump);
}
