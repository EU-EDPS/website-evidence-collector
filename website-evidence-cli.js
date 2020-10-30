const collector = require("./website-evidence-collector");
const argv = require("./lib/argv");
const logger = require("./lib/logger");

const UserAgent =
  "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/72.0.3617.0 Safari/537.36";
const WindowSize = {
  width: 1680,
  height: 927, // arbitrary value close to 1050
};

(async () => {
  await collector(argv, logger);
})();
