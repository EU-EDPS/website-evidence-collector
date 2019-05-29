// jshint esversion: 8

const { safeJSONParse } = require('./tools');
const fs = require('fs');
const url = require('url');
const logger = require('./logger');

const { FiltersEngine, NetworkFilter, makeRequest } = require('@cliqz/adblocker');
const { parse } = require('tldts');

// setup easyprivacy matching
// https://github.com/cliqz-oss/adblocker/issues/123
let filtersEngines = {
  'easyprivacy.txt': FiltersEngine.parse(fs.readFileSync('assets/easyprivacy.txt', 'utf8'), {loadCosmeticFilters: false}),
  'fanboy-annoyance.txt': FiltersEngine.parse(fs.readFileSync('assets/fanboy-annoyance.txt', 'utf8'), {loadCosmeticFilters: false}),
};

const typesMapping = {
  document: 'main_frame',
  eventsource: 'other',
  fetch: 'xhr',
  font: 'font',
  image: 'image',
  manifest: 'other',
  media: 'media',
  other: 'other',
  script: 'script',
  stylesheet: 'stylesheet',
  texttrack: 'other',
  websocket: 'websocket',
  xhr: 'xhr',
};

// see https://gist.github.com/pirate/9298155edda679510723#gistcomment-2734349
const decodeURLParams = search => {
  const hashes = search.slice(search.indexOf("?") + 1).split("&");
  return hashes.reduce((params, hash) => {
    const split = hash.indexOf("=");

    if (split < 0) {
      return Object.assign(params, {
          [hash]: null
      });
    }

    const key = hash.slice(0, split);
    const val = hash.slice(split + 1);

    return Object.assign(params, { [key]: decodeURIComponent(val) });
  }, {});
};

module.exports.setup_beacon_recording = async function(page) {
  // prepare easyprivacy list matching
  // await page.setRequestInterception(true);
  page.on('request', (request) => {
    Object.entries(filtersEngines).forEach(([listName, filtersEngine]) => {
      const {
        match, // `true` if there is a match
        redirect, // data url to redirect to if any
        exception, // instance of NetworkFilter exception if any
        filter, // instance of NetworkFilter which matched
      } = filtersEngine.match(makeRequest({
        sourceUrl: request.frame().url(),
        type: typesMapping[request.resourceType()],
        url: request.url(),
      }, parse));
      if(match) {
        // console.log("easyprivacy: " + request.url());
        let stack = [{
          filenName: request.frame().url(),
          source: `requested from ${request.frame().url()} and matched with ${listName} filter ${filter}`,
        }];
        const parsedUrl = url.parse(request.url());
        const query = parsedUrl.query ? decodeURLParams(parsedUrl.query) : null;
        let message = `Potential Tracking Beacon captured via ${listName} with endpoint ${parsedUrl.protocol}//${parsedUrl.host}${parsedUrl.pathname}.`;
        logger.log('warn', message, {
          type: "Request.Tracking",
          stack: stack,
          data: {
            url: request.url(),
            query: query,
          },
        });
      }
    });
  });
};
