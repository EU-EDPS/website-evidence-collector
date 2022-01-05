const StandardConfig = require("../config.js");
const logger = require("../lib/logger");
const collector = require("../collector/index");

const fs = require("fs-extra");
const path = require("path");

jest.setTimeout(50000);

var logsy;

beforeEach(() => {
  logsy = logger.create({
    console: { silent: true },
    file: { enabled: false },
  });
});

afterEach(() => {
  logsy.close();
  logsy = null;
});

test("collector is correctly instantiated", async () => {
  var args = StandardConfig("https://github.com");
  args.overwrite = true;

  const c = await collector(args, logsy);

  expect(c.output).toBeDefined();
  expect(c.args).toBeDefined();
  expect(c.logger).toBeDefined();

  // closer inspection of values
  expect(c.args).toBe(args);
  expect(c.output.uri_ins).toBe("https://github.com");

  await c.endSession();
});

test("collector browser session is correctly instantiated", async () => {
  var args = StandardConfig("https://github.com");
  args.overwrite = true;
  const c = await collector(args, logsy);
  await c.createSession();

  expect(c.output.browser).toBeDefined();
  expect(c.browserSession).toBeDefined();
  expect(c.pageSession).toBeDefined();

  await c.endSession();
});

test("collector browser session is correctly discarded", async () => {
  var args = StandardConfig("https://github.com");
  args.overwrite = true;
  const c = await collector(args, logsy);
  await c.createSession();
  await c.endSession();

  expect(c.browserSession).toBe(null); 
  expect(c.output.end_time).toBeDefined();
  
  // pageSession must remain defined as we will depend on this output, even after discarding the browser
  expect(c.pageSession).toBeDefined();
});

test("collector page session is correctly discarded", async () => {
  var args = StandardConfig("https://github.com");
  args.overwrite = true;
  const c = await collector(args, logsy);
  await c.createSession();
  await c.endSession();
  await c.endPageSession();

  expect(c.browserSession).toBe(null); 
  expect(c.pageSession).toBe(null); 
});

test("collector can test https + ssl connection", async () => {
  var args = StandardConfig("https://github.com");
  args.overwrite = true;

  const c = await collector(args, logsy);
  await c.testConnection();

  expect(c.output.secure_connection.https_support).toBe(true);
  expect(c.output.testSSL).toBeDefined();
});

test("collector can load html locally", async () => {
  var args = StandardConfig("https://localhost");
  args.overwrite = true;
  const c = await collector(args, logsy);

  await c.createSession();
  var localPath = `${path.join(__dirname, "test_output", "testpage.html")}`;

  var localHtml = fs.readFileSync(localPath);
  var result = await c.getPage("file://" + localPath);
  await c.endSession();

  expect(c.source).toBeDefined();
  expect(result).toBeDefined();
});

test("collector can collect links", async () => {
  var args = StandardConfig("http://localhost");
  args.overwrite = true;
  const c = await collector(args, logsy);

  const bs = await c.createSession();
  var localPath = `${path.join(__dirname, "test_output", "testpage.html")}`;
  await c.getPage("file://" + localPath);
  await c.collectLinks();
  await c.endSession();

  expect(c.output.links).toBeDefined();
  expect(c.output.links.firstParty.length).toEqual(2);
  expect(c.output.links.thirdParty.length).toEqual(3);
  expect(c.output.links.social.length).toEqual(2);
});

test("collector can collect forms", async () => {
  var args = StandardConfig("http://localhost");
  args.overwrite = true;
  // var logsy = logger.newLogger();
  const c = await collector(args, logsy);

  const bs = await c.createSession();
  var localPath = `${path.join(__dirname, "test_output", "testpage.html")}`;
  await c.getPage("file://" + localPath);
  await c.collectForms();
  await c.endSession();

  expect(c.output.unsafeForms.length).toEqual(1);
});

test("collector can collect cookies", async () => {
  var args = StandardConfig("http://localhost");
  args.overwrite = true;
  //  var logsy = logger.newLogger();
  const c = await collector(args, logsy);

  const bs = await c.createSession();
  var localPath = `${path.join(__dirname, "test_output", "testpage.html")}`;
  await c.getPage("file://" + localPath);
  await c.collectCookies();
  await c.endSession();

  // test html will set 2 JS cookies, but they will not appear here
  // as this is only cookies collected via http - which should be 3 youtube cookis
  // the later log inspection should catch the JS ones.

  // this test case in best case slightly wonky as youtube does not always set the same amount of cookies
  expect(c.output.cookies.length > 1).toBe(true);
});

test("collector can collect localstorage", async () => {
  var args = StandardConfig("http://localhost");
  args.overwrite = true;
  // var logsy = logger.newLogger();
  const c = await collector(args, logsy);

  const bs = await c.createSession();
  var localPath = `${path.join(__dirname, "test_output", "testpage.html")}`;
  await c.getPage("file://" + localPath);
  await c.collectLocalStorage();
  await c.endSession();

  expect(c.output.localStorage).toBeDefined();
});

// todo: websockets tests
