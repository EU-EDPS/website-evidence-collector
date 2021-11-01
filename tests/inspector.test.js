const StandardConfig = require("../config.js");
const logger = require("../lib/logger");
const collector = require("../collector/index");
const inspector = require("../inspector/index");
const path = require("path");

var c, logsy, args;

jest.setTimeout(50000);

beforeAll(async () => {
  args = StandardConfig("http://localhost");
  args.overwrite = true;
  args.pageTimeout = 3000;

  logsy = logger.create({ console: { silent: true } });
  c = await collector(args, logsy);
  await c.createSession();
  var localPath = `${path.join(__dirname, "test_output", "testpage.html")}`;
  await c.getPage("file://" + localPath);
  await c.collectCookies();
  await c.collectLinks();
  await c.collectLocalStorage();
  await c.collectForms();
  await c.endSession();
});

test("inspector is instantiated correctly", async () => {
  const inspect = await inspector(args, logsy, c.pageSession, c.output);
  expect(inspect.eventData).toBeDefined();
  expect(inspect.logger).toBeDefined();
  expect(inspect.args).toBeDefined();
  expect(inspect.output).toBeDefined();
  expect(inspect.pageSession).toBeDefined();
  expect(inspect.output).toEqual(c.output);
});

test("inspector can inspect cookies", async () => {
  const inspect = await inspector(args, logsy, c.pageSession, c.output);
  await inspect.inspectCookies();

  // this is not always a specific number, because youtube sets different number of cookies
  // test page loads a youtube video - also to be investigated - is this because of iframe loading times - as that could be a general flaw?
  expect(c.output.cookies.length > 5).toBe(true);
});

test("inspector can inspect hosts", async () => {
  const inspect = await inspector(args, logsy, c.pageSession, c.output);
  await inspect.inspectHosts();

  // same as with cookies, we cannot always determine the right number of hosts
  expect(c.output.hosts.requests.thirdParty.length > 8).toBe(true);
  expect(c.output.hosts.links.thirdParty.length).toEqual(3);
  expect(c.output.hosts.cookies.thirdParty.length >= 2).toBe(true);
});

test("inspector can run end 2 end", async () => {
  const inspect = await inspector(args, logsy, c.pageSession, c.output);

  await inspect.inspectCookies();
  await inspect.inspectLocalStorage();
  await inspect.inspectBeacons();
  await inspect.inspectHosts();

  expect(c.output.hosts.requests.thirdParty.length).toEqual(10);
});
