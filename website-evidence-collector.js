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
const cookieParser = require('tough-cookie').Cookie;
const { page_setup } = require('./lib/page-setup');

const { FiltersEngine, NetworkFilter, makeRequest } = require('@cliqz/adblocker');
const { parse } = require('tldts');
const safeJSONParse = (obj) => {
  try {
    return JSON.parse(obj);
  } catch(e) {
    return obj;
  }
};

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


(async() => {
  const browser = await puppeteer.launch({
    // headless: false,
    args: [
      `--user-agent="${UserAgent}"`,
      `--window-size=${WindowSize.width},${WindowSize.height}`
    ],
  });

  const page = await browser.newPage();

  await page_setup(page, WindowSize);

  var reportedEvents = [];

  await page.exposeFunction('reportEvent', (type, stack, data) => {
    let event = {
      type: type,
      stack: stack.slice(1,3), // remove reference to Document.set (0) and keep two more elements (until 3)
      ts: new Date(),
    };
    switch(type) {
      case 'Cookie.JS':
        event.raw = data;
        event.data = [cookieParser.parse(data)];
        break;
      default:
        event.data = data;
    }

    reportedEvents.push(event);
  });

  // track incoming traffic for HTTP cookies
  page.on('response', response => {
    const req = response.request();
    // console.log(req.method(), response.status(), req.url());

    let cookieHTTP = response._headers['set-cookie'];
    if(cookieHTTP) {
      let stack = [{
        filenName: req.url(),
        source: `set in Set-Cookie HTTP response header for ${req.url()}`,
      }];
      let splitCookieHeaders = cookieHTTP.split("\n");
      let data = splitCookieHeaders.map(cookieParser.parse);
      reportedEvents.push({
        type: "Cookie.HTTP",
        stack: stack,
        ts: new Date(),
        raw: cookieHTTP,
        data: data,
      });
    }
  });

  const url = process.argv[2];

  // prepare easyprivacy list matching
  // await page.setRequestInterception(true);
  page.on('request', (request) => {
    let ts = new Date();
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
        reportedEvents.push({
          type: "Request.Tracking",
          stack: stack,
          ts: ts,
          data: request.url(),
        });
      }
    });
  });

  // recording har file if 2nd commandline argument is set
  const harFile = process.argv[3]; // is undefined if not set
  const har = new PuppeteerHar(page);
  if(harFile) {
    await har.start({ path: harFile });
  }

  // recording websockets
  // https://stackoverflow.com/a/54110660/1407622
  var webSocketLog = {}
  const client = page._client;

  client.on('Network.webSocketCreated', ({requestId, url}) => {
    if(!webSocketLog[requestId]) {
      webSocketLog[requestId] = {
        ts: new Date(),
        url: url,
        messages: [],
      };
    }
    console.log('Network.webSocketCreated', requestId, url);
  });

  client.on('Network.webSocketClosed', ({requestId, timestamp}) => {
    console.log('Network.webSocketClosed', requestId, timestamp);
  });

  client.on('Network.webSocketFrameSent', ({requestId, timestamp, response}) => {
    webSocketLog[requestId].messages.push({
      ts: timestamp,
      io: 'out',
      m: response.payloadData.split("\n").map(safeJSONParse),
    });
    console.log('Network.webSocketFrameSent', requestId, timestamp, response.payloadData);
  });

  client.on('Network.webSocketFrameReceived', ({requestId, timestamp, response}) => {
    webSocketLog[requestId].messages.push({
      ts: timestamp,
      io: 'in',
      m: response.payloadData.split("\n").map(safeJSONParse),
    });
    console.log('Network.webSocketFrameReceived', requestId, timestamp, response.payloadData);
  });

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

  console.dir(reportedEvents, {maxArrayLength: null, depth: null});
})();
