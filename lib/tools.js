/**
 * @file Tooling functions
 * @author Robert Riemann <robert.riemann@edps.europa.eu>
 * @copyright European Data Protection Supervisor (2019)
 * @license EUPL-1.2
 */

// jshint esversion: 8

const url = require("url");
const path = require("path");
// const logger = require("./logger");

safeJSONParse = function (obj) {
  try {
    return JSON.parse(obj);
  } catch (e) {
    return obj;
  }
};

module.exports.safeJSONParse = safeJSONParse;

module.exports.isFirstParty = function (refs_regexp, uri_test) {
  // is first party if uri_test starts with any uri_ref ignoring, parameters, protocol and port
  let uri_test_parsed = url.parse(uri_test);
  let test_stripped = `${uri_test_parsed.hostname}${uri_test_parsed.pathname}`;

  return test_stripped.match(refs_regexp);
};

module.exports.getLocalStorage = async function (page, logger, data = {}) {
  // based on https://stackoverflow.com/a/54355801/1407622
  const client = page._client();
  for (const frame of page.frames()) {
    // it is unclear when the following url values occur:
    // potentially about:blank is the frame before the very first page is browsed
    if (!frame.url().startsWith("http")) continue; // filters chrome-error://, about:blank and empty url

    const securityOrigin = new url.URL(frame.url()).origin;
    let response;
    try {
      response = await client.send("DOMStorage.getDOMStorageItems", {
        storageId: { isLocalStorage: true, securityOrigin },
      });
    } catch (error) {
      // ignore error if no localStorage for given origin can be
      // returned, see also: https://stackoverflow.com/q/62356783/1407622
      logger.log("warn", error.message, { type: "Browser" });
    }
    if (response && response.entries.length > 0) {
      let entries = {};
      for (const [key, val] of response.entries) {
        entries[key] = {
          value: safeJSONParse(val),
        };
      }
      // console.log(response.entries);
      data[securityOrigin] = Object.assign({}, data[securityOrigin], entries);
    }
  }
  return data;
};
