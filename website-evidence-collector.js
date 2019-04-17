const puppeteer = require('puppeteer');

const detailedDiff = require("deep-object-diff").detailedDiff;

const _ = require('lodash');

// const cookieParse = require('cookie').parse;

(async() => {
  const browser = await puppeteer.launch({
    executablePath: '/home/rriemann/lib/node_modules/puppeteer/.local-chromium/linux-609904/chrome-linux/chrome',
  });
  const page = await browser.newPage();

  var cookies = {};
  var cookiesByURL = {};

  // https://github.com/jasonLaster/cdp-pause-points/blob/9260aafda97ebe975fc6d9a03979c8866ebd4b0e/pause-points.js#L66
  const client = await page.target().createCDPSession();
  await client.send('Debugger.enable');

  // https://github.com/GoogleChrome/puppeteer/issues/313#issuecomment-322939468
  page.on('response', async(response) => {
    const req = response.request();
    console.log(req.method(), response.status(), req.url());
    // console.log(response._headers['Set-Cookie']);
    // console.log(response._headers);
    let httpCookie = response._headers['set-cookie'];
    console.log("COOKIE: " + httpCookie);
    if(httpCookie) {
      // cookieName = httpCookie.match(/^[^=]+/)[0];
      // Object.keys(cookieParse(httpCookie))
      httpCookie.split("\n").forEach( cookieValue => {
        cookieName = cookieValue.match(/^[^=]+/)[0]
        if(Array.isArray(cookiesByURL[cookieName])) {
          cookiesByURL[cookieName].push(req.url());
        } else {
          cookiesByURL[cookieName] = [req.url()];
        }
      });
    }
  });

  // track cookies
  var processCookies = async function(script) {
    console.log("Script: " + script.url);
    // example from https://stackoverflow.com/a/50290081/1407622
    let currentCookies = _.cloneDeep(cookies);
    let newCookies = await client.send('Network.getAllCookies');

    let diff = detailedDiff(currentCookies, newCookies['cookies']);

    // focus on added and updated
    (Object.values(diff['added']).concat(Object.values(diff['updated']))).forEach( cookie => {
      if(Array.isArray(cookiesByURL[cookie['name']])) {
        cookiesByURL[cookie['name']].push(script.url);
      } else {
        cookiesByURL[cookie['name']] = [script.url];
      }
    });

    cookies = newCookies['cookies'];
  }

  client.on("Debugger.scriptParsed", processCookies)

  const url = process.argv[2];
  await page.goto(url, {waitUntil : 'networkidle2', timeout: 0 });

  cookies = await page._client.send('Network.getAllCookies');

  console.log(cookiesByURL)

  console.log(cookies);

  // await page.screenshot({path: 'example.png'});

  await browser.close();
})();
