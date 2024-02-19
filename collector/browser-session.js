const puppeteer = require("puppeteer");
const PuppeteerHar = require("puppeteer-har");
const path = require("path");
const url = require("url");
const escapeRegExp = require("lodash/escapeRegExp");
const got = require("got");
const sampleSize = require("lodash/sampleSize");

const UserAgent =
  "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/116.0.5845.96 Safari/537.36";

const WindowSize = {
  width: 1680,
  height: 927, // arbitrary value close to 1050
};

const { setup_cookie_recording } = require("../lib/setup-cookie-recording");
const { setup_beacon_recording } = require("../lib/setup-beacon-recording");
const {
  setup_websocket_recording,
} = require("../lib/setup-websocket-recording");

const { set_cookies } = require("../lib/set-cookies");
const {
  isFirstParty,
  getLocalStorage,
} = require("../lib/tools");

async function createBrowserSession(browser_args, browser_logger) {
  let page, hosts, har, webSocketLog, browser_context, logger, args;

  args = browser_args;
  logger = browser_logger;

  const browser = await puppeteer.launch({
    // https://developer.chrome.com/articles/new-headless/.
    headless: args.headless ? 'new' : false,
    defaultViewport: {
      width: WindowSize.width,
      height: WindowSize.height,
    },
    userDataDir: args.browserProfile
      ? args.browserProfile
      : args.output
      ? path.join(args.output, "browser-profile")
      : undefined,
    args: [
      `--user-agent=${UserAgent}`,
      `--window-size=${WindowSize.width},${WindowSize.height}`,
    ].concat(args.browserOptions, args["--"] || []),
  });

  // go to page, start har etc
  async function start(output) {
    // create url map and regex - urls.js ?
    let uri_refs_stripped = output.uri_refs.map((uri_ref) => {
      let uri_ref_parsed = url.parse(uri_ref);
      return escapeRegExp(
        `${uri_ref_parsed.hostname}${uri_ref_parsed.pathname.replace(
          /\/$/,
          ""
        )}`
      );
    });

    var refs_regexp = new RegExp(`^(${uri_refs_stripped.join("|")})$`, "i");

    // load the page to traverse
    page = (await browser.pages())[0];
    //browser_context = await browser.new .createIncognitoBrowserContext();
    //page = await browser_context.newPage();

    if (args.dntJs) {
      args.dnt = true; // imply Do-Not-Track HTTP Header
    }

    if (args.dnt) {
      // source: https://stackoverflow.com/a/47973485/1407622 (setting extra headers)
      // source: https://stackoverflow.com/a/5259004/1407622 (headers are case-insensitive)
      output.browser.extra_headers.dnt = 1;
      page.setExtraHTTPHeaders({ dnt: "1" });

      // do not use by default, as it is not implemented by all major browsers,
      // see: https://caniuse.com/#feat=do-not-track
      if (args.dntJs) {
        await page.evaluateOnNewDocument(() => {
          Object.defineProperty(navigator, "doNotTrack", { value: "1" });
        });
      }
    }

    // forward logs from the browser console
    page.on("console", (msg) =>
      logger.log("debug", msg.text(), { type: "Browser.Console" })
    );

    // setup tracking
    await setup_cookie_recording(page, logger);
    await setup_beacon_recording(page, logger);

    webSocketLog = setup_websocket_recording(page, logger);

    hosts = {
      requests: {
        firstParty: new Set(),
        thirdParty: new Set(),
      },
      beacons: {
        firstParty: new Set(),
        thirdParty: new Set(),
      },
      cookies: {
        firstParty: new Set(),
        thirdParty: new Set(),
      },
      localStorage: {
        firstParty: new Set(),
        thirdParty: new Set(),
      },
      links: {
        firstParty: new Set(),
        thirdParty: new Set(),
      },
    };

    // record all requested hosts
    page.on("request", (request) => {
      const l = url.parse(request.url());
      // note that hosts may appear as first and third party depending on the path
      if (isFirstParty(refs_regexp, l)) {
        hosts.requests.firstParty.add(l.hostname);
      } else {
        if (l.protocol != "data:") {
          hosts.requests.thirdParty.add(l.hostname);
        }
      }
    });

    // set predefined cookies if any
    set_cookies(page, output.uri_ins, args, output, logger);

    har = new PuppeteerHar(page);

    await har.start({
      path: args.output ? path.join(args.output, "requests.har") : undefined,
    });

    async function gotoPage(u) {
      logger.log("info", `browsing now to ${u}`, { type: "Browser" });

      let page_response;

      try {
        page_response = await page.goto(u, {
          timeout: args.pageTimeout,
          waitUntil: "networkidle2",
        });

        await page.waitForNetworkIdle();

        if (page_response === null) {
          // see: https://github.com/puppeteer/puppeteer/issues/2479#issuecomment-408263504
          page_response = await page.waitForResponse(() => true);
        }
      } catch (error) {
        logger.log("error", error.message, { type: "Browser" });
        process.exit(2);
      }

      return page_response;
    }

    async function browseSamples(
      page,
      localStorage,
      root_uri,
      firstPartyLinks,
      userSet
    ) {
      let browse_links = sampleSize(firstPartyLinks, args.max - userSet.length - 1);

      let browsing_history = [root_uri].concat(
        userSet,
        browse_links.map((l) => l.href)
      );

      for (const link of browsing_history.slice(1)) {
        try {
          // check mime-type and skip if not html
          const head = await got(link, {
            method: "HEAD",
            // ignore Error: unable to verify the first certificate (https://stackoverflow.com/a/36194483)
            // certificate errors should be checked in the context of the browsing and not during the mime-type check
            https: {
              rejectUnauthorized: false,
            },
          });

          if (!head.headers["content-type"].startsWith("text/html")) {
            logger.log(
              "info",
              `skipping now ${link} of mime-type ${head["content-type"]}`,
              { type: "Browser" }
            );
            continue;
          }

          logger.log("info", `browsing now to ${link}`, { type: "Browser" });

          await page.goto(link, {
            timeout: args.pageTimeout,
            waitUntil: "networkidle2",
          });
        } catch (error) {
          logger.log("warn", error.message, { type: "Browser" });
          continue;
        }

        await page.waitForTimeout(args.sleep); // in ms
        localStorage = await getLocalStorage(page, logger, localStorage);
      }

      return browsing_history;
    }

    async function screenshot() {
      // record screenshots
      try {
        await page.screenshot({
          path: path.join(args.output, "screenshot-top.png"),
        });
        await page.evaluate(() => {
          window.scrollTo(0, document.body.scrollHeight);
        });
        await page.screenshot({
          path: path.join(args.output, "screenshot-bottom.png"),
        });
        await page.screenshot({
          path: path.join(args.output, "screenshot-full.png"),
          fullPage: true,
        });
      } catch (error) {
        // see: https://github.com/EU-EDPS/website-evidence-collector/issues/21 and https://github.com/puppeteer/puppeteer/issues/2569
        logger.log(
          "info",
          `not saving some screenshots due to software limitations`,
          { type: "Browser" }
        );
      }
    }

    return {
      browser,
      page,
      har,
      hosts,
      refs_regexp,
      webSocketLog,
      gotoPage,
      screenshot,
      browseSamples,
    };
  }

  // close and destroy
  async function end() {
    if (har) {
      await har.stop();
    }
    await page.close();
    await browser.close();
  }

  return { browser, page, har, hosts, start, end };
}

module.exports = { createBrowserSession };
