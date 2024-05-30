const StandardConfig = require("../config.js");
const reporter = require("../reporter/index");
const fs = require("fs-extra");
const path = require("path");

var report, args, output, source;
const dir = "./tests/test_output/report";

jest.setTimeout(50000);

beforeAll(async () => {
  args = StandardConfig("http://localhost");
  args.output = dir;

  output = fs.readJSONSync("./tests/test_output/inspection.json");
  source = fs.readFileSync("./tests/test_output/testpage.html", "utf8");
  report = await reporter(args);

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

test("reporter is instantiated correctly", async () => {
  expect(report.args).toBeDefined();
});

test("report can save html report", async () => {
  report.generateHtml(output);
  expect(fs.existsSync(path.join(dir, "inspection.html"))).toBe(true);
});

test("report can save docx report", async () => {
  await report.generateOfficeDoc(output);
  expect(fs.existsSync(path.join(dir, "inspection.docx"))).toBe(true);
});

test("report can save yaml reports", async () => {
  // cookies reporting
  report.saveYaml(output.cookies, "cookies.yml");
  expect(fs.existsSync(path.join(dir, "cookies.yml"))).toBe(true);

  // local storage reporting
  report.saveYaml(output.localStorage, "local-storage.yml");
  expect(fs.existsSync(path.join(dir, "local-storage.yml"))).toBe(true);

  // beacons
  report.saveYaml(output.beacons, "beacons.yml");
  expect(fs.existsSync(path.join(dir, "beacons.yml"))).toBe(true);

  // all
  report.saveYaml(output, "inspection.yml");
  expect(fs.existsSync(path.join(dir, "inspection.yml"))).toBe(true);

  const inspect_yaml = report.readYaml("inspection.yml");
  expect(inspect_yaml.title).toEqual("Website Evidence Collection");
});

test("report can save source", async () => {
  report.saveSource(source);
  expect(fs.existsSync(path.join(dir, "source.html"))).toBe(true);
  let s = fs.readFileSync(path.join(dir, "source.html"), "utf8");
  expect(s).toEqual(source);
  //expect(c.output.cookies.length).toEqual(8);
});
