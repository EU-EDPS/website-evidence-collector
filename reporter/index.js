const fs = require("fs-extra");
const yaml = require("js-yaml");
const path = require("path");
const pug = require("pug");

const groupBy = require("lodash/groupBy");
const flatten = require("lodash/flatten");

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
    let yaml_dump = yaml.safeDump(data, { noRefs: true });

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
        groupBy: groupBy,
        inlineCSS: fs.readFileSync(
          require.resolve("github-markdown-css/github-markdown.css")
        ),
      })
    );

    if (c.args.output) {
      fs.writeFileSync(path.join(c.args.output, filename), html_dump);
    }

    if (log && c.args.html) {
      console.log(html_dump);
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
