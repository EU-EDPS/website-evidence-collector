#!/usr/bin/env node
// jshint esversion: 8

/**
 * @file Collects evidence from websites on processed data in transit and at rest.
 * @author Robert Riemann <robert.riemann@edps.europa.eu>
 * @copyright European Data Protection Supervisor (2019)
 * @license EUPL-1.2
 */

//const argv = require('./lib/argv');

const fs = require("fs-extra");
const url = require("url");
const yaml = require("js-yaml");
const path = require("path");
const pug = require("pug");

const groupBy = require("lodash/groupBy");
const flatten = require("lodash/flatten");

const { isFirstParty, getLocalStorage } = require("./lib/tools");

const output_lib = require("./collector/output");
const browsersession = require("./collector/browser-session");
const collector_io = require("./collector/io");
const collector_connection = require("./collector/connection");
const collector_inspect = require("./collector/inspector");

async function run(args, logger) {
  // create the root folder structure
  collector_io.init(args);

  // create the output hash...
  const output = await output_lib.createOutput(args);

  // return browser, page and har in one object to have it all in one place
  const browser_session = await browsersession.createBrowserSession(
    args,
    logger
  );

  output.browser.version = await browser_session.browser.version();
  output.browser.user_agent = await browser_session.browser.userAgent();

  // ########################################################
  // HTTPS and SSL Tests
  // ########################################################
  await collector_connection.testHttps(output.uri_ins, output);
  await collector_connection.testSSL(output.uri_ins, args, logger, output);

  // ########################################################
  // Start browser and goto the first uri
  // ########################################################
  const page_session = await browser_session.start(output);
  const response = await page_session.gotoPage(output.uri_ins);

  // log redirects
  output.uri_redirects = response
    .request()
    .redirectChain()
    .map((req) => {
      return req.url();
    });

  // log the destination uri after redirections
  output.uri_dest = page_session.page.url();
  await page_session.page.waitForTimeout(args.sleep); // in ms

  //localstorage? - is this needed - seems like it is overwriten later
  let localStorage = await getLocalStorage(page_session.page);

  // ########################################################
  // Collect Links
  // ########################################################

  // get all links from page
  const links = await collector_inspect.collectLinks(page_session.page);
  var mappedLinks = await collector_inspect.mapLinksToParties(
    links,
    page_session.hosts,
    page_session.refs_regexp
  );
  output.links.firstParty = mappedLinks.firstParty;
  output.links.thirdParty = mappedLinks.thirdParty;

  output.links.social = await collector_inspect.filterSocialPlatforms(links);

  // prepare regexp to match links by their href or their caption
  output.links.keywords = await collector_inspect.filterKeywords(links);

  // unsafe webforms
  output.unsafeForms = await collector_inspect.unsafeWebforms(
    page_session.page
  );

  // browse sample history and log to localstorage
  let browse_user_set = args.browseLink || [];
  output.browsing_history = await page_session.browseSamples(
    page_session.page,
    localStorage,
    output.uri_dest,
    output.links.firstParty,
    browse_user_set
  );

  // record screenshots
  if (args.output && args.screenshots) {
    await page_session.screenshot();
  }

  // ########################################################
  // Collect Cookies
  // ########################################################

  const cookies = await collector_inspect.collectCookies(
    page_session.page,
    output.start_time
  );

  // END OF BROWSING
  await browser_session.end();
  output.end_time = new Date();

  // ########################################################
  // Websockets Reporting
  // ########################################################
  if (args.output && args.json) {
    fs.writeFileSync(
      path.join(args.output, "websockets-log.json"),
      JSON.stringify(page_session.webSocketLog, null, 2)
    );
  }

  output.websockets = page_session.webSocketLog;

  // ########################################################
  // Cookies  reporting
  // ########################################################

  let event_data_all = await new Promise((resolve, reject) => {
    logger.query(
      {
        start: 0,
        order: "desc",
        limit: Infinity,
      },
      (err, results) => {
        if (err) return reject(err);
        return resolve(results.file);
      }
    );
  });

  // filter only events with type set
  let event_data = event_data_all.filter((event) => {
    return !!event.type;
  });

  let cookies_from_events = flatten(
    event_data
      .filter((event) => {
        return event.type.startsWith("Cookie");
      })
      .map((event) => {
        event.data.forEach((cookie) => {
          cookie.log = {
            stack: event.stack,
            type: event.type,
            timestamp: event.timestamp,
            location: event.location,
          };
        });
        return event.data;
      })
  );

  cookies.forEach((cookie) => {
    let matched_event = cookies_from_events.find((cookie_from_events) => {
      return (
        cookie.name == cookie_from_events.key &&
        cookie.domain == cookie_from_events.domain &&
        cookie.path == cookie_from_events.path
      );
    });
    if (!!matched_event) {
      cookie.log = matched_event.log;
    }

    if (
      isFirstParty(
        page_session.refs_regexp,
        `cookie://${cookie.domain}${cookie.path}`
      )
    ) {
      cookie.firstPartyStorage = true;
      page_session.hosts.cookies.firstParty.add(cookie.domain);
    } else {
      cookie.firstPartyStorage = false;
      page_session.hosts.cookies.thirdParty.add(cookie.domain);
    }
  });

  output.cookies = cookies.sort(function (a, b) {
    return b.expires - a.expires;
  });

  if (args.output && args.yaml) {
    let yaml_dump = yaml.safeDump(cookies, { noRefs: true });
    fs.writeFileSync(path.join(args.output, "cookies.yml"), yaml_dump);
  }

  // ########################################################
  // LocalStorage Reporting
  // ########################################################

  let storage_from_events = event_data.filter((event) => {
    return event.type.startsWith("Storage");
  });

  Object.keys(localStorage).forEach((origin) => {
    let hostname = new url.URL(origin).hostname;
    let isFirstPartyStorage = isFirstParty(page_session.refs_regexp, origin);
    if (isFirstPartyStorage) {
      page_session.hosts.localStorage.firstParty.add(hostname);
    } else {
      page_session.hosts.localStorage.thirdParty.add(hostname);
    }

    let originStorage = localStorage[origin];
    Object.keys(originStorage).forEach((key) => {
      // add if entry is linked to first-party host
      originStorage[key].firstPartyStorage = isFirstPartyStorage;
      // find log for a given key
      let matched_event = storage_from_events.find((event) => {
        return origin == event.origin && Object.keys(event.data).includes(key);
      });
      if (!!matched_event) {
        originStorage[key].log = {
          stack: matched_event.stack,
          type: matched_event.type,
          timestamp: matched_event.timestamp,
          location: matched_event.location,
        };
      }
    });
  });

  output.localStorage = localStorage;

  if (args.output && args.yaml) {
    let yaml_dump = yaml.safeDump(localStorage, { noRefs: true });
    fs.writeFileSync(path.join(args.output, "local-storage.yml"), yaml_dump);
  }

  // ########################################################
  // Beacons Reporting
  // ########################################################
  let beacons_from_events = flatten(
    event_data
      .filter((event) => {
        return event.type.startsWith("Request.Tracking");
      })
      .map((event) => {
        return Object.assign({}, event.data, {
          log: {
            stack: event.stack,
            // type: event.type,
            timestamp: event.timestamp,
          },
        });
      })
  );

  for (const beacon of beacons_from_events) {
    const l = url.parse(beacon.url);

    if (beacon.listName == "easyprivacy.txt") {
      if (isFirstParty(page_session.refs_regexp, l)) {
        page_session.hosts.beacons.firstParty.add(l.hostname);
      } else {
        page_session.hosts.beacons.thirdParty.add(l.hostname);
      }
    }
  }

  // make now a summary for the beacons (one of every hostname+pathname and their occurrance)
  let beacons_from_events_grouped = groupBy(beacons_from_events, (beacon) => {
    let url_parsed = url.parse(beacon.url);
    return `${url_parsed.hostname}${url_parsed.pathname.replace(/\/$/, "")}`;
  });

  let beacons_summary = [];
  for (const [key, beacon_group] of Object.entries(
    beacons_from_events_grouped
  )) {
    beacons_summary.push(
      Object.assign({}, beacon_group[0], {
        occurrances: beacon_group.length,
      })
    );
  }

  beacons_summary.sort((b1, b2) => {
    return b2.occurances - b1.occurances;
  });

  output.beacons = beacons_summary;

  // ########################################################
  // Hosts Reporting
  // ########################################################
  let arrayFromParties = function (array) {
    return {
      firstParty: Array.from(array.firstParty),
      thirdParty: Array.from(array.thirdParty),
    };
  };

  output.hosts = {
    requests: arrayFromParties(page_session.hosts.requests),
    beacons: arrayFromParties(page_session.hosts.beacons),
    cookies: arrayFromParties(page_session.hosts.cookies),
    localStorage: arrayFromParties(page_session.hosts.localStorage),
    links: arrayFromParties(page_session.hosts.links),
  };

  // output to various formats

  if (args.output) {
    let yaml_dump = yaml.safeDump(beacons_summary, { noRefs: true });
    fs.writeFileSync(path.join(args.output, "beacons.yml"), yaml_dump);
  }

  if (args.output || args.yaml) {
    let yaml_dump = yaml.safeDump(output, { noRefs: true });

    if (args.yaml && !args.quiet) {
      console.log(yaml_dump);
    }

    if (args.output) {
      fs.writeFileSync(path.join(args.output, "inspection.yml"), yaml_dump);
    }
  }

  if (args.output || args.json) {
    let json_dump = JSON.stringify(output, null, 2);

    if (args.json && !args.quiet) {
      console.log(json_dump);
    }

    if (args.output) {
      fs.writeFileSync(path.join(args.output, "inspection.json"), json_dump);
    }
  }

  if (args.output || args.html) {
    let html_template =
      args["html-template"] || path.join(__dirname, "assets/template.pug");
    let html_dump = pug.renderFile(
      html_template,
      Object.assign({}, output, {
        pretty: true,
        basedir: __dirname,
        groupBy: groupBy,
        inlineCSS: fs.readFileSync(
          require.resolve("github-markdown-css/github-markdown.css")
        ),
      })
    );

    if (args.html) {
      console.log(html_dump);
    }

    if (args.output) {
      fs.writeFileSync(path.join(args.output, "inspection.html"), html_dump);
    }
  }

  return output;
}

module.exports = run;
