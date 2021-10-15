const StandardConfig = require("../config.js");
//const collector = require("../website-evidence-collector-lib.js");
const logger = require("../lib/logger");
const collector = require("../collector/index");
const inspector = require("../inspector/index");

const fs = require("fs-extra");
const path = require("path");

jest.setTimeout(20000);

test("collector is correctly instantiated", async () => {
  var args = StandardConfig("https://test.com");
  var logsy = logger.newLogger();
  const c = await collector(args, logsy);

  expect(c.output).toBeDefined();
  expect(c.args).toBeDefined();
  expect(c.logger).toBeDefined();

  // closer inspection of values
  expect(c.args).toBe(args);
  expect(c.output.uri_ins).toBe("https://test.com");
});

test("collector browser session is correctly instantiated", async () => {
  var args = StandardConfig("https://test.com");
  var logsy = logger.newLogger();
  const c = await collector(args, logsy);
  await c.createSession();

  expect(c.output.browser).toBeDefined();
  expect(c.browserSession).toBeDefined();
  expect(c.pageSession).toBeDefined();
});

test("collector can test https + ssl connection", async () => {
  var args = StandardConfig("https://test.com");
  var logsy = logger.newLogger();
  const c = await collector(args, logsy);
  await c.testConnection();

  expect(c.output.secure_connection.https_support).toBe(true);
  expect(c.output.testSSL).toBeDefined();
});

test("collector loads the default url", async () => {
  var args = StandardConfig("https://test.com");
  args.sleep = 0;

  var logsy = logger.newLogger("", "error", ["console"], true);
  const c = await collector(args, logsy);

  try {
    const bs = await c.createSession();
    var result = await c.getPage();

    // we expect a redirect to www for this domain
    expect(c.output.uri_dest).toBe("https://www.test.com/");
    expect(result).toBeDefined();

    c.endSession();

    // we will log redirects
    //console.log(c.output.uri_redirects);
  } catch (ex) {
    console.error(ex);
  }
});

test("collector collects everything", async () => {
  var args = StandardConfig("https://www.test.com");
  args.sleep = 0;

  var logsy = logger.newLogger("", "error", ["console", "file"], true);
  const c = await collector(args, logsy);

  try {
    const bs = await c.createSession();
    var result = await c.getPage();

    // we expect a redirect to www for this domain
    expect(c.output.uri_dest).toBe("https://www.test.com/");
    expect(result).toBeDefined();

    await c.collectLinks();
    await c.collectForms();
    await c.collectCookies();
    await c.collectLocalStorage();
    await c.collectWebsocketLog();

    c.endSession();
  } catch (ex) {
    console.error(ex);
    throw ex;
  }
});
