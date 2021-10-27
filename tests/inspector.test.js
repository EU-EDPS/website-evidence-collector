const StandardConfig = require("../config.js");
const logger = require("../lib/logger");
const collector = require("../collector/index");
const inspector = require("../inspector/index");
const path = require("path");

var c, logsy, args;

jest.setTimeout(50000);

beforeAll(async () => {
  args = StandardConfig("http://localhost");
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
  expect(c.output.cookies.length).toEqual(8);
});

test("inspector can inspect hosts", async () => {
  const inspect = await inspector(args, logsy, c.pageSession, c.output);
  await inspect.inspectHosts();
  expect(c.output.hosts.requests.thirdParty.length).toEqual(10);
  expect(c.output.hosts.links.thirdParty.length).toEqual(3);
  expect(c.output.hosts.cookies.thirdParty.length).toEqual(3);
});

test("inspector can run end 2 end", async () => {
  const inspect = await inspector(args, logsy, c.pageSession, c.output);

  await inspect.inspectCookies();
  await inspect.inspectLocalStorage();
  await inspect.inspectBeacons();
  await inspect.inspectHosts();

  /*
  fs.writeFileSync(
    "./tests/test_output/output.json",
    JSON.stringify(inspect.output)
  );
  fs.writeFileSync(
    "./tests/test_output/eventdata.json",
    JSON.stringify(inspect.eventData)
  );

  c.pageSession.browser = null;
  fs.writeFileSync(
    "./tests/test_output/page_session.json",
    JSON.stringify({
      //har: c.pageSession.har,
      // page: c.pageSession.page,
      webSocketLog: c.pageSession.webSocketLog,
      hosts: c.pageSession.hosts,
      refs_regexp: c.pageSession.refs_regexp,
    })
  );*/

  expect(c.output.hosts.requests.thirdParty.length).toEqual(10);
});
