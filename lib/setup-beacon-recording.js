/**
 * @file Setup recording of Cookie and LocalStorage API use
 * @author Robert Riemann <robert.riemann@edps.europa.eu>
 * @copyright European Data Protection Supervisor (2019)
 * @license EUPL-1.2
 */

// jshint esversion: 8

const { safeJSONParse } = require("./tools");
const fs = require("fs");
const url = require("url");
const path = require("path");
//const logger = require('./logger');

const {
  PuppeteerBlocker,
  fromPuppeteerDetails,
} = require("@cliqz/adblocker-puppeteer");

// The following options make sure that blocker will behave optimally for the
// use-case of identifying blocked network requests as well as the rule which
// triggered blocking in the first place.
const blockerOptions = {
  // This makes sure that the instance of `PuppeteerBlocker` keeps track of the
  // exact original rule form (from easylist or easyprivacy). Otherwise some
  // information might be lost and calling `toString(...)` will only give back
  // an approximate version.
  debug: true,

  // By default, instance of `PuppeteerBlocker` will perform some dynamic
  // optimizations on rules to increase speed. As a result, it might not always
  // be possible to get back the original rule which triggered a 'match' for
  // a specific request. Disabling these optimizations will always ensure we
  // can know which rule triggered blocking.
  enableOptimizations: false,

  // We are only interested in "network rules" to identify requests which would
  // be blocked. Disabling "cosmetic rules" allows to resources.
  loadCosmeticFilters: false,
};

// setup easyprivacy matching
// https://github.com/cliqz-oss/adblocker/issues/123
let blockers = {
  "easyprivacy.txt": PuppeteerBlocker.parse(
    fs.readFileSync(path.join(__dirname, "../assets/easyprivacy.txt"), "utf8"),
    blockerOptions
  ),
  "fanboy-annoyance.txt": PuppeteerBlocker.parse(
    fs.readFileSync(
      path.join(__dirname, "../assets/fanboy-annoyance.txt"),
      "utf8"
    ),
    blockerOptions
  ),
};

// source: https://gist.github.com/pirate/9298155edda679510723#gistcomment-2734349
const decodeURLParams = (search) => {
  const hashes = search.slice(search.indexOf("?") + 1).split("&");
  return hashes.reduce((params, hash) => {
    const split = hash.indexOf("=");

    if (split < 0) {
      return Object.assign(params, {
        [hash]: null,
      });
    }

    const key = hash.slice(0, split);
    const val = hash.slice(split + 1);

    try {
      return Object.assign(params, { [key]: decodeURIComponent(val) });
    } catch {
      return Object.assign(params, { [key]: val });
    }

  }, {});

};

module.exports.setup_beacon_recording = async function (page, logger) {
  // prepare easyprivacy list matching
  // requires to call somewhere: await page.setRequestInterception(true);
  page.on("request", (request) => {
    Object.entries(blockers).forEach(([listName, blocker]) => {
      const {
        match, // `true` if there is a match
        filter, // instance of NetworkFilter which matched
      } = blocker.match(fromPuppeteerDetails(request));

      if (match) {
        let stack = [
          {
            fileName: request.frame()?.url(),
            source: `requested from ${
              request.frame()?.url() || "undefined source"
            } and matched with ${listName} filter ${filter}`,
          },
        ];

        const parsedUrl = url.parse(request.url());
        let query = null;
        if (parsedUrl.query) {
          query = decodeURLParams(parsedUrl.query);
          for (let param in query) {
            query[param] = safeJSONParse(query[param]);
          }
        }
        let message = `Potential Tracking Beacon captured via ${listName} with endpoint ${parsedUrl.protocol}//${parsedUrl.host}${parsedUrl.pathname}.`;
        logger.log("warn", message, {
          type: "Request.Tracking",
          stack: stack,
          data: {
            url: request.url(),
            query: query,
            filter: filter.toString(),
            listName: listName,
          },
        });
      }
    });
  });
};
