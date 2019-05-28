// jshint esversion: 8

// change global directory with npm config edit
// install puppeteer globally with npm save -g puppeteer
// link puppeteer locally with npm link puppeteer

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

  await setup_cookie_recording(page);
  setup_beacon_recording(page);

  const url = process.argv[2];

  // recording har file if 2nd commandline argument is set
  const harFile = process.argv[3]; // is undefined if not set
  const har = new PuppeteerHar(page);
  if(harFile) {
    await har.start({ path: harFile });
  }

  let webSocketLog = setup_websocket_recording(page);

  logger.log('info', `browsing now to ${url}`, {type: 'browser'});

  await page.goto(url, {waitUntil : 'networkidle2' });

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

  if(harFile) await har.stop();

  await browser.close();

  // reporting
  fs.writeFileSync('websockets-log.json', JSON.stringify(webSocketLog, null, 2));
  

  // console.dir(reportedEvents, {maxArrayLength: null, depth: null});
})();
