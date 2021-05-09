const StandardConfig = require("../config.js");
const WebsiteEvidenceCollector = require("../website-evidence-collector-lib.js");
const logger = require("../lib/logger");
const tmplogger = require("../lib/tmplogger");

const run = async function () {
  var args = StandardConfig("https://en.zalando.de");
  args.output = false; //  config.folder + "/html/" + name;
  args.json = false;
  args.yaml = false;
  args.html = false;
  args.quiet = true;
  args.headless = true;
  args.overwrite = true;
  args.dnt = true;

  var logsy = tmplogger.newLogger();

  var json = await WebsiteEvidenceCollector(args, logsy);
  console.log(json.beacons);
};

run();
