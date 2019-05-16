// jshint esversion: 8

// change global directory with npm config edit
// install puppeteer globally with npm save -g puppeteer
// link puppeteer locally with npm link puppeteer

const puppeteer = require('puppeteer');
const PuppeteerHar = require('puppeteer-har');
const fs = require('fs');
const cookieParser = require('tough-cookie').Cookie;

(async() => {
  const browser = await puppeteer.launch({
    // headless: false,
  });
  const page = await browser.newPage();
  await page.setViewport({
    width: 1280,
    height: 800
  });
  await page.bringToFront();

  page.on('console', msg => console.log('PAGE LOG: ', msg.text()));

  // inject stacktraceJS https://www.stacktracejs.com/
  const stackTraceHelper = fs.readFileSync(require.resolve('stacktrace-js/dist/stacktrace.js'), 'utf8');
  // https://chromedevtools.github.io/devtools-protocol/tot/Page#method-addScriptToEvaluateOnNewDocument
  await page.evaluateOnNewDocument(stackTraceHelper);

  await page.evaluateOnNewDocument(() => {
    origDescriptor = Object.getOwnPropertyDescriptor(Document.prototype, 'cookie');
    Object.defineProperty(document, 'cookie', {
      get() {
        return origDescriptor.get.call(this);
      },
      set(value) {
        // https://www.stacktracejs.com/#!/docs/stacktrace-js
        let stack = StackTrace.getSync({offline: true});
        window.reportEvent("Cookie.JS", stack, value);

        return origDescriptor.set.call(this, value);
      },
      enumerable: true,
      configurable: true
    });

    // inject storage set recorder
    // https://stackoverflow.com/a/49093643/1407622
    Object.defineProperty(window, 'localStorage', {
      configurable: true,
      enumerable: true,
      value: new Proxy(localStorage, {
        set: function (ls, prop, value) {
          //console.log(`direct assignment: ${prop} = ${value}`);
          let stack = StackTrace.getSync({offline: true});
          let hash = {};
          hash[prop] = JSON.parse(value);
          window.reportEvent("Storage.LocalStorage", stack, hash);
          ls[prop] = value;
          return true;
        },
        get: function(ls, prop) {
          // The only property access we care about is setItem. We pass
          // anything else back without complaint. But using the proxy
          // fouls 'this', setting it to this {set: fn(), get: fn()}
          // object.
          if (prop !== 'setItem') {
            if (typeof ls[prop] === 'function') {
              return ls[prop].bind(ls);
            } else {
              return ls[prop];
            }
          }
          return (...args) => {
            let stack = StackTrace.getSync({offline: true});
            let hash = {};
            hash[args[0]] = JSON.parse(args[1]);
            window.reportEvent("Storage.LocalStorage", stack, hash);
            ls.setItem.apply(ls, args);
          };
        }
      })
    });
  });

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

  // recording har file if 2nd commandline argument is set
  const harFile = process.argv[3]; // is undefined if not set
  const har = new PuppeteerHar(page);
  if(harFile) {
    await har.start({ path: harFile });
  }

  await page.goto(url, {waitUntil : 'networkidle2' });

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
