const fs = require("fs-extra");
const yaml = require("js-yaml");
const path = require("path");
const pug = require("pug");

function inspector(args) {
  const c = {
    args: args,
  };

  c.saveJson = function (filename, data) {
    let json_dump = JSON.stringify(data, null, 2);
    fs.writeFileSync(path.join(c.args.output, filename), json_dump);
  };

  c.saveYaml = function (filename, data) {
    let yaml_dump = yaml.safeDump(data, { noRefs: true });
    fs.writeFileSync(path.join(c.args.output, filname), yaml_dump);
  };

  c.generateHtml = function (
    data,
    filename = "inspection.html",
    template = "assets/template.pug"
  ) {
    let html_template =
      c.args["html-template"] || path.join(__dirname, template);
    let html_dump = pug.renderFile(
      html_template,
      Object.assign({}, data, {
        pretty: true,
        basedir: __dirname,
        groupBy: groupBy,
        inlineCSS: fs.readFileSync(
          require.resolve("github-markdown-css/github-markdown.css")
        ),
      })
    );

    fs.writeFileSync(path.join(c.args.output, filename), html_dump);
  };

  return c;
}
