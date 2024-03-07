// jshint esversion: 8

const collector_io = require("./io");
const output_lib = require("./output");
const collector_connection = require("./connection");
const collector_inspect = require("./inspector");

const browsersession = require("./browser-session");
const { isFirstParty, getLocalStorage } = require("../lib/tools");

async function collector(args, logger) {
  // create the root folder structure
  collector_io.init(args);

  // create the output hash...
  const output = await output_lib.createOutput(args);

  const c = {
    browserSession: null,
    pageSession: null,
    logger: logger,

    args: args,
    output: output,
    source: null,
  };

  c.createSession = async function () {
    c.browserSession = await browsersession.createBrowserSession(
      c.args,
      c.logger
    );

    c.output.browser.version = await c.browserSession.browser.version();
    c.output.browser.user_agent = await c.browserSession.browser.userAgent();
    c.pageSession = await c.browserSession.start(c.output);
  };

  c.testConnection = async function () {
    await collector_connection.testHttps(c.output.uri_ins, c.output);
    await collector_connection.testSSL(
      c.output.uri_ins,
      c.args,
      c.logger,
      c.output
    );
  };

  c.getPage = async function (url = null) {
    if (!url) {
      url = c.output.uri_ins;
    }

    const response = await c.pageSession.gotoPage(url);

    const {LOGIN_SELECTOR, PASSWORD_SELECTOR, LOGIN_USERNAME, LOGIN_PASSWORD} = process.env;

    // log into web app if all required parameters are given
    if(LOGIN_SELECTOR && PASSWORD_SELECTOR && LOGIN_USERNAME && LOGIN_PASSWORD){
      await c.pageSession.page.type(LOGIN_SELECTOR, LOGIN_USERNAME);
      await c.pageSession.page.type(PASSWORD_SELECTOR, LOGIN_PASSWORD);
      await c.pageSession.page.keyboard.press('Enter');
      // 5 seconds should be enough for data retrieval after loading authenticated area
      await c.pageSession.page.waitForTimeout(5000);
    }

    // log redirects
    c.output.uri_redirects = response
      .request()
      .redirectChain()
      .map((req) => {
        return req.url();
      });

    // log the destination uri after redirections
    c.output.uri_dest = c.pageSession.page.url();
    c.source = await c.pageSession.page.content();

    await c.pageSession.page.waitForTimeout(args.sleep); // in ms

    // record screenshots
    if (c.args.output && c.args.screenshots) {
      await c.pageSession.screenshot();
    }

    return response;
  };

  c.collectLinks = async function () {
    // get all links from page
    const links = await collector_inspect.collectLinks(c.pageSession.page, c.logger);

    var mappedLinks = await collector_inspect.mapLinksToParties(
      links,
      c.pageSession.hosts,
      c.pageSession.refs_regexp
    );

    c.output.links.firstParty = mappedLinks.firstParty;
    c.output.links.thirdParty = mappedLinks.thirdParty;

    c.output.links.social = await collector_inspect.filterSocialPlatforms(
      links
    );

    // prepare regexp to match links by their href or their caption
    c.output.links.keywords = await collector_inspect.filterKeywords(links);
  };

  c.collectCookies = async function () {
    c.output.cookies = await collector_inspect.collectCookies(
      c.pageSession.page,
      c.output.start_time
    );
  };

  c.collectForms = async function () {
    // unsafe webforms
    c.output.unsafeForms = await collector_inspect.unsafeWebforms(
      c.pageSession.page
    );
  };

  c.collectLocalStorage = async function () {
    c.output.localStorage = await getLocalStorage(c.pageSession.page, c.logger);
  };

  c.collectWebsocketLog = async function () {
    c.output.websocketLog = c.pageSession.webSocketLog;
  };

  c.browseSamples = async function (localStorage, user_set = []) {
    c.output.browsing_history = await c.pageSession.browseSamples(
      c.pageSession.page,
      localStorage,
      c.output.uri_dest,
      c.output.links.firstParty,
      user_set
    );
  };

  c.endSession = async function () {
    if(c.browserSession){
      await c.browserSession.end();
      c.browserSession = null;
    }
  
    c.output.end_time = new Date();
  };

  c.endPageSession = function () {
    c.pageSession = null;
  };
  
  return c;
}

module.exports = collector;
