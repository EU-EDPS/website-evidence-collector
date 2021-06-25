/**
 * @file Tooling functions
 * @author Robert Riemann <robert.riemann@edps.europa.eu>
 * @copyright European Data Protection Supervisor (2019)
 * @license EUPL-1.2
 */

// jshint esversion: 8

const url = require('url');
const path = require ('path');
const logger = require('./logger');

const uniqWith = require('lodash/uniqWith');
const escapeRegExp = require('lodash/escapeRegExp');
const argv = require('./argv');
const uri_ins = argv._[0];

const uri_refs = [uri_ins].concat(argv.firstPartyUri);
module.exports.appConfig = {
  uri_refs: uri_refs,
  uri_refs_stripped: uri_refs.map((uri_ref) => {
    uri_ref_parsed = url.parse(uri_ref);
    return escapeRegExp(`${uri_ref_parsed.hostname}${uri_ref_parsed.pathname.replace(/\/$/, "")}`);
  })
}
module.exports.appConfig.refs_regexp = new RegExp(`^(${module.exports.appConfig.uri_refs_stripped.join('|')})\\b`, 'i');

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
    if(!frame.url().startsWith('http')) continue; // filters chrome-error://, about:blank and empty url

    const securityOrigin = new url.URL(frame.url()).origin;
    let response;
    try {
      response = await client.send('DOMStorage.getDOMStorageItems',
        { storageId: { isLocalStorage: true, securityOrigin } }
      );
    } catch (error) {
      // ignore error if no localStorage for given origin can be
      // returned, see also: https://stackoverflow.com/q/62356783/1407622
      logger.log('warn', error.message, {type: 'Browser'});
    }
    if (response && response.entries.length > 0) {
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

module.exports.getPageLinks = async function(page) {
  const links_with_duplicates = await page.evaluate( () => {
    return [].map.call(Array.from(document.querySelectorAll('a[href]')), a => {
      return {
        href: a.href.split('#')[0], // link without fragment
        inner_text: a.innerText,
        inner_html: a.innerHTML.trim(),
      };
    }).filter(link => {
      return link.href.startsWith('http');
    });
  });

  // https://lodash.com/docs/4.17.15#uniqWith
  const links = uniqWith(links_with_duplicates, (l1, l2) => {
    // consider URLs equal if only fragment (part after #) differs.
    return l1.href.split('#').shift() === l2.href.split('#').shift();
  });

  var output_links = {
    firstParty: [],
    thirdParty: [],
    all: [],
  };

  for (const link of links) {
    const l = url.parse(link.href);
    l.inner_text = link.inner_text;
    l.inner_html = link.inner_html;

    output_links.all.push(l);
    if (module.exports.isFirstParty(module.exports.appConfig.refs_regexp, l)) {
      //logger.log('info', 'FOUND 1st URL: '+l.href);
      output_links.firstParty.push(l);
    }
    else {
      //logger.log('info', 'FOUND 3rd URL: '+l.href);
      output_links.thirdParty.push(l);
    }
  }
  return output_links;
};

/**
 * It seems yargs can't handle default values for optional arguments.
 * (so, only a default value when the argument is explicitly set)
 * This function compensates for that missing functionality
 */
module.exports.getSpiderValue = function () {
  const arg_length = process.argv.length;
  for (var i=0; i<arg_length; i++) {
    const arg = process.argv[i];
    if (arg == "-x" || arg == "--spider") {
      if (arg_length >= (i + 2) && process.argv[i+1].substr(0,1) != "-") {
	// spider argument has an explicit value, return this value 
	return parseInt(process.argv[i+1]);
	// (note: yargs will already do a type check, so no need for that here)
      }
      else {
	// spider argument has no explicit value, or a negative numerical value. return -1 by default
	return -1;
      }
    }
  }
  // spider argument not set. Return 0 (which should have the same result
  return 0;
};
