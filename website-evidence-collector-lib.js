#!/usr/bin/env node
// jshint esversion: 8

/**
 * @file Collects evidence from websites on processed data in transit and at rest.
 * @author Robert Riemann <robert.riemann@edps.europa.eu>
 * @copyright European Data Protection Supervisor (2019)
 * @license EUPL-1.2
 */

//const argv = require('./lib/argv');
const collector = require("./collector/index");
const inspector = require("./inspector/index");
const reporter = require("./reporter/index");

async function run(args, logger) {
  // ########################################################
  // create a new collection instance
  // ########################################################
  const collect = await collector(args, logger);

  // create browser, session, har, pagesession etc to be able to collect
  await collect.createSession();

  //test the ssl and https connection
  await collect.testConnection();

  // go to the target url specified in the args - also possible to overload with a custom url.
  await collect.getPage();

  // ########################################################
  // Collect Links, Forms and Cookies to populate the output
  // ########################################################
  await collect.collectLinks();
  await collect.collectForms();
  await collect.collectCookies();
  await collect.collectLocalStorage();
  await collect.collectWebsocketLog();

  // browse sample history and log to localstorage
  let browse_user_set = args.browseLink || [];
  await collect.browseSamples(collect.output.localStorage, browse_user_set);

  // END OF BROWSING - discard the browser and page
  await collect.endSession();

  // ########################################################
  //  inspecting - this will process the collected data and place it in a structured format in the output object
  // ########################################################

  const inspect = await inspector(
    args,
    logger,
    collect.pageSession,
    collect.output
  );

  await inspect.inspectCookies();
  await inspect.inspectLocalStorage();
  await inspect.inspectBeacons();
  await inspect.inspectHosts();

  // ########################################################
  //  Reporting - this will process the output object into different formats, yaml, json, html
  //  todo: isolate in reporter class
  // ########################################################

  if (args.output) {
    const report = reporter(args);

    if (args.json) {
      //websockets
      report.saveJson(collect.output.websocketLog, "websockets-log.json");

      // all
      report.saveJson(collect.output, "inspection.json");
    }

    if (args.yaml) {
      // cookies reporting
      report.saveYaml(collect.output.cookies, "cookies.yml");

      // local storage reporting
      report.saveYaml(collect.output.localStorage, "local-storage.yml");

      // beacons
      report.saveYaml(collect.output.beacons, "beacons.yml");

      // all
      report.saveYaml(collect.output, "inspection.yml");
    }

    if (args.html) {
      report.generateHtml(collect.output);
    }
  }

  return collect.output;
}

module.exports = run;
