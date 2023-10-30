// jshint esversion: 8

const fs = require("fs-extra");
const yaml = require("js-yaml");
const path = require("path");
const pug = require("pug");
const HTMLtoDOCX = require("html-to-docx");
const { spawnSync } = require('node:child_process');
const puppeteer = require("puppeteer");

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

function reporter(args) {
  const c = {
    args: args,
  };

  c.saveJson = function (data, filename, log = true) {
    let json_dump = JSON.stringify(data, null, 2);

    if (c.args.output) {
      fs.writeFileSync(path.join(c.args.output, filename), json_dump);
    }

    if (log && c.args.json) {
      console.log(json_dump);
    }
  };

  c.saveYaml = function (data, filename, log = true) {
    let yaml_dump = yaml.dump(data, { noRefs: true });

    if (c.args.output) {
      fs.writeFileSync(path.join(c.args.output, filename), yaml_dump);
    }

    if (log && c.args.yaml) {
      console.log(yaml_dump);
    }
  };

  c.readYaml = function (filename) {
    return yaml.load(
      fs.readFileSync(path.join(c.args.output, filename), "utf8")
    );
  };

  c.generateHtml = function (
    data,
    filename = "inspection.html",
    log = true,
    template = "../assets/template.pug"
  ) {
    let html_template =
      c.args["html-template"] || path.join(__dirname, template);
    let html_dump = pug.renderFile(
      html_template,
      Object.assign({}, data, {
        pretty: true,
        basedir: path.join(__dirname, "../assets"),
        jsondir: ".", // images in the folder of the inspection.json
        groupBy: require("lodash/groupBy"),
        marked: marked, // we need to pass the markdown engine to template for access at render-time (as opposed to comile time), see https://github.com/pugjs/pug/issues/1171
        fs: fs,
        yaml: yaml,
        path: path,
        inlineCSS: fs.readFileSync(
          require.resolve("github-markdown-css/github-markdown.css")
        ),
        filterOptions: {marked: {}},
      })
    );

    if (c.args.output) {
      fs.writeFileSync(path.join(c.args.output, filename), html_dump);
    }

    if (log && c.args.html) {
      console.log(html_dump);
    }
  };

  c.convertHtmlToPdf = async function (htmlfilename = "inspection.html", pdffilename = "inspection.pdf") {
    if (c.args.pdf && c.args.output) {
      const browser = await puppeteer.launch({
        // https://developer.chrome.com/articles/new-headless/.
        headless: 'new',
      });
      const pages = await browser.pages();
      await pages[0].goto("file://" + path.resolve(path.join(c.args.output, htmlfilename)), {waitUntil: 'networkidle0'});
      await pages[0].pdf({
        path: path.resolve(path.join(c.args.output, pdffilename)),
        format: 'A4',
        printBackground: true,
        displayHeaderFooter: true,
        headerTemplate: `
          <div style="width: 100%; font-size: 11px; padding: 5px 5px 0; position: relative;">
              <div style="bottom: 5px; text-align: center;"><span class="title"></span></div>
          </div>
        `,
        footerTemplate: `
          <div style="width: 100%; font-size: 11px; padding: 5px 5px 0; position: relative;">
              <div style="top: 5px; text-align: center;"><span class="pageNumber"></span>/<span class="totalPages"></span></div>
          </div>
        `,
        // this is needed to prevent content from being placed over the footer
        margin: { top: '1.5cm', bottom: '1cm' },
      })
      await browser.close();
    }
  };
  
  c.generateOfficeDoc = async function (
    data,
    filename = "inspection.docx",
    log = true,
    template = "../assets/template-office.pug"
  ) {
    if (c.args.output) {
      let office_template =
        c.args["office-template"] || path.join(__dirname, template);
      let html_dump = pug.renderFile(
        office_template,
        Object.assign({}, data, {
          pretty: true,
          basedir: path.join(__dirname, "../assets"),
          jsondir: ".", // images in the folder of the inspection.json
          groupBy: require("lodash/groupBy"),
          marked: marked, // we need to pass the markdown engine to template for access at render-time (as opposed to comile time), see https://github.com/pugjs/pug/issues/1171
          fs: fs,
          yaml: yaml,
          path: path,
          inlineCSS: fs.readFileSync(
            require.resolve("github-markdown-css/github-markdown.css")
          ),
          filterOptions: {marked: {}},
        })
      );

      if(c.args.usePandoc) {
        // console.warn("Using pandoc to generate", filename);
        let ret = spawnSync('pandoc', ['-f', 'html', '--number-sections', '--toc', '--output', filename], {
          cwd: c.args.output,
          input: html_dump,
          encoding: 'utf8',
        });
        if(ret[2]) {
          console.log(ret[2]);
        }
      } else {
        if(filename.endsWith(".odt")) {
          console.error("To generate .odt, you must have pandoc installed and specify --use-pandoc.");
          process.exit(1);
        }
        
        // console.warn("Using NPM html-to-docx to generate", filename);
        const documentOptions = {
          // decodeUnicode: true,
          orientation: "portrait",
          pageSize: {width: "21.0cm", height: "29.7cm"},
          pageNumber: true,
          // lineNumber: true,
          // lineNumberOptions: {countBy: 5},
          title: data.title,
          lang: "en-UK",
          creator: `EDPS Website Evidence Collector v${data.script.version.npm} using NPM html-to-docx`,
        };
        const fileBuffer = await HTMLtoDOCX(html_dump, null, documentOptions, null);
        fs.writeFileSync(path.join(c.args.output, filename), fileBuffer);
      }
    }
  };

  c.saveSource = function (source, filename = "source.html") {
    if (c.args.output) {
      fs.writeFileSync(path.join(c.args.output, filename), source);
    }
  };

  return c;
}

module.exports = reporter;
