const StandardConfig = require("../config.js");
const wec = require("../index");
const logger = require("../lib/logger");
const fs = require("fs-extra");
const path = require("path");
const argv = require("../lib/argv");

var report, args, output;
const dir = "./tests/test_output/report";

jest.setTimeout(50000);

beforeAll(async () => {
  var localPath = `${path.join(__dirname, "test_output", "testpage.html")}`;
  args = StandardConfig("file://" + localPath);
  args.output = dir;

  if (fs.existsSync(dir)) {
    fs.emptyDirSync(dir);
    fs.removeSync(dir);
  }

  fs.mkdirSync(dir);
});

afterAll(() => {
  fs.emptyDirSync(dir);
  fs.removeSync(dir);
});

test("WEC Argv is equal to standard config", () => {
  var config = StandardConfig("https://localhost");
  var args = argv.parse("https://localhost");

  // we can't do a deep compare, due to argv overloads
  // overloads are however not used in code, but merely a cmdline convenience
  Object.keys(config).forEach((x) => {
    expect(x + ":" + args[x]).toEqual(x + ":" + config[x]);
  });
});

test("WEC runs end to end and produces the correct default output", async () => {
  await wec(args, logger.create());
  expect(fs.existsSync(path.join(dir, "beacons.yml"))).toBe(true);
  expect(fs.existsSync(path.join(dir, "cookies.yml"))).toBe(true);
  expect(fs.existsSync(path.join(dir, "inspection.html"))).toBe(true);
  expect(fs.existsSync(path.join(dir, "inspection.json"))).toBe(true);
  expect(fs.existsSync(path.join(dir, "local-storage.yml"))).toBe(true);
  expect(fs.existsSync(path.join(dir, "requests.har"))).toBe(true);

  expect(fs.existsSync(path.join(dir, "screenshot-bottom.png"))).toBe(true);
  expect(fs.existsSync(path.join(dir, "screenshot-full.png"))).toBe(true);
  expect(fs.existsSync(path.join(dir, "screenshot-top.png"))).toBe(true);

  expect(fs.existsSync(path.join(dir, "source.html"))).toBe(true);
  expect(fs.existsSync(path.join(dir, "websockets-log.json"))).toBe(true);
});
