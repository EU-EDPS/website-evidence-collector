/**
 * @file Tooling functions
 * @author Robert Riemann <robert.riemann@edps.europa.eu>
 * @copyright European Data Protection Supervisor (2019)
 * @license EUPL-1.2
 */

// jshint esversion: 8

const url = require('url');
const path = require ('path');

safeJSONParse = function (obj) {
  try {
    return JSON.parse(obj);
  } catch(e) {
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

module.exports.getLocalStorage = async function(page, data = {}) {
  // based on https://stackoverflow.com/a/54355801/1407622
  const client = page._client;
  for (const frame of page.frames()) {
    // it is unclear when the following url values occur:
    // potentially about:blank is the frame before the very first page is browsed
    if(frame.url() == 'about:blank' || frame.url() == '') continue;

    const securityOrigin = new URL(frame.url()).origin;
    const response = await client.send('DOMStorage.getDOMStorageItems',
      { storageId: { isLocalStorage: true, securityOrigin } },
    );
    if (response.entries.length > 0) {
      let entries = {};
      for (const [key,val] of response.entries) {
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
