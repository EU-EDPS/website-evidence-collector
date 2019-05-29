#!/usr/bin/env node
// jshint esversion: 8

var argv = require('yargs')
  .scriptName('website-evidence-collector.js')
  .usage('Usage: $0 <command> <URI> [options]')
  .command('inspect-page', 'Gather evidence when browsing one webpage')
  .example('$0 inspect-page https://example.com/about -b https://example.com')
  .demandCommand(2) // ask for command and for inspection url
  .alias('m', 'max')
  .nargs('m', 1)
  .describe('m', 'Sets maximum number of random links for browsing')
  .number('m')

  // seeding is apparently not supported TODO
  // .alias('s', 'seed')
  // .nargs('s', 1)
  // .describe('s', 'Sets seed for random choice of links for browsing')
  // .number('m')

  .alias('b', 'base')
  .nargs('b', 1)
  .describe('b', 'Sets the bounds for first-party links and pages')
  .array('b')

  .alias('l', 'browse-link')
  .nargs('l', 1)
  .describe('l', 'Adds URI to list of links for browsing')
  .array('l')

  .describe('headless', 'Hides the browser window')
  .boolean('headless')
  .default('headless', true)

  .describe('lang', 'Change the browser language')
  .default('lang', 'en')

  .help('h')
  .alias('h', 'help')
  .epilog('Copyright European Union 2019, licensed under EUPL-1.2 (see LICENSE.txt)')
  .argv;

const uri_ins = argv.uri;

console.log(uri_ins)

process.exit();

const UserAgent = "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/72.0.3617.0 Safari/537.36";
const WindowSize = {
  width: 1680,
  height: 927, // quite arbitrary
};

const puppeteer = require('puppeteer');
const PuppeteerHar = require('puppeteer-har');
const fs = require('fs');

const logger = require('./lib/logger');
const { setup_cookie_recording } = require('./lib/setup-cookie-recording');
const { setup_beacon_recording } = require('./lib/setup-beacon-recording');
const { setup_websocket_recording } = require('./lib/setup-websocket-recording');

var output = {};


(async() => {
  const browser = await puppeteer.launch({
    // headless: false,
    args: [
      `--user-agent="${UserAgent}"`,
      `--window-size=${WindowSize.width},${WindowSize.height}`
    ],
  });

  const page = await browser.newPage();
  await page.setViewport({
    width: WindowSize.width,
    height: WindowSize.height,
  });
  await page.bringToFront();

  page.on('console', msg => logger.log('debug', msg.text(), {type: 'browser.console'}));

  // setup tracking
  await setup_cookie_recording(page);
  setup_beacon_recording(page);
  let webSocketLog = setup_websocket_recording(page);

  const har = new PuppeteerHar(page);
  await har.start({ path: 'requests.har' });

  logger.log('info', `browsing now to ${uri_ins}`, {type: 'browser'});

  await page.goto(uri_ins, {waitUntil : 'networkidle2' });

  await page.waitFor(3000); // wait 3 seconds

  // example from https://stackoverflow.com/a/50290081/1407622
  // Here we can get all of the cookies
  const cookies = await page._client.send('Network.getAllCookies');
  const links = await page.evaluate( () => {
    return [].map.call(document.querySelectorAll('a[href]'), a => {
      return {
        href: a.href,
        inner_text: a.innerText,
        inner_html: a.innerHTML,
      };
    });
  });

  // console.dir({
  //   cookies: cookies.cookies,
  //   links: links,
  // }, {'maxArrayLength': null});

  // await page.screenshot({path: 'example.png'});

  await har.stop();

  await browser.close();

  // reporting
  fs.writeFileSync('websockets-log.json', JSON.stringify(webSocketLog, null, 2));


  // console.dir(reportedEvents, {maxArrayLength: null, depth: null});
})();
