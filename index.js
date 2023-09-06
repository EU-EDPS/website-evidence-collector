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
  // ########################################################

  // args passed will determine what is stored on disk and what is sent to console
  const report = reporter(args);
  // args.output - determines if anything is stored on disk
  // args.html - determines if html is sent to console
  // args.json - determins if json is sent to console
  // args.yaml - determins if yaml is sent to console

  //websockets
  report.saveJson(collect.output.websocketLog, "websockets-log.json", false);

  // all
  report.saveJson(collect.output, "inspection.json");

  // cookies reporting
  report.saveYaml(collect.output.cookies, "cookies.yml", false);

  // local storage reporting
  report.saveYaml(collect.output.localStorage, "local-storage.yml", false);

  // beacons
  report.saveYaml(collect.output.beacons, "beacons.yml", false);

  // all
  report.saveYaml(collect.output, "inspection.yml");

  // store html on disk
  report.generateHtml(collect.output);
  
  // store docx on disk
  await report.generateOfficeDoc(collect.output);

  // convert html to pdf
  await report.convertHtmlToPdf();

  // store source on disk
  report.saveSource(collect.source);

  return collect.output;
}

module.exports = run;
