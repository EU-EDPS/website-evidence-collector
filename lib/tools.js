// jshint esversion: 8

const url = require('url');
const path = require ('path');

module.exports.safeJSONParse = function (obj) {
  try {
    return JSON.parse(obj);
  } catch(e) {
    return obj;
  }
};

module.exports.isFirstParty = function (refs_regexp, uri_test) {
  // is first party if uri_test starts with any uri_ref ignoring, parameters, protocol and port
  let uri_test_parsed = url.parse(uri_test);
  let test_stripped = `${uri_test_parsed.hostname}${uri_test_parsed.pathname}`;

  return test_stripped.match(refs_regexp);
};
