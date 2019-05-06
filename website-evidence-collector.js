// jshint esversion: 8

// change global directory with npm config edit
// install puppeteer globally with npm save -g puppeteer
// link puppeteer locally with npm link puppeteer

const puppeteer = require('puppeteer');
const PuppeteerHar = require('puppeteer-har');
const fs = require('fs');

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
        var stack = StackTrace.getSync({offline: true});
        window.report_cookie_set(value, stack);

        return origDescriptor.set.call(this, value);
      },
      enumerable: true,
      configurable: true
    });

    // inject storage set recorder
    //
    origDescriptorLS = Object.getOwnPropertyDescriptor(window, 'localStorage');
    Object.defineProperty(window, 'localStorage', {
      setItem(value) {
        var stack = StackTrace.getSync({offline: true});
        window.report_localstorage_set(value, stack);

        return origDescriptorLS.setItem.call(this, value);
      },
      enumerable: true,
      configurable: true
    });
  });

  // https://www.stacktracejs.com/#!/docs/stacktrace-js
  await page.exposeFunction('report_cookie_set', (cookieJS, stack) => {
    console.log("Cookie (JS): ", cookieJS);
    console.log(stack.slice(1,3)); // remove reference to Document.set (0) and keep two more elements (until 3)
  });

  await page.exposeFunction('report_localstorage_set', (localStorageItem, stack) => {
    cosole.log("LocalStorage: ", localStorageItem);
    console.log(stack.slice(1,3));
  });

  // track incoming traffic for HTTP cookies
  page.on('response', response => {
    const req = response.request();
    // console.log(req.method(), response.status(), req.url());

    let cookieHTTP = response._headers['set-cookie'];
    if(cookieHTTP) {
      console.log("Cookie (HTTP): " + cookieHTTP);
      let stack = [{
        filenName: req.url(),
        source: `set in request for ${req.url()} (HTTP)`,
      }];
      console.log(stack);
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

  console.dir({
    cookies: cookies.cookies,
    links: links,
  }, {'maxArrayLength': null});

  // await page.screenshot({path: 'example.png'});

  if(harFile) await har.stop();
  
  await browser.close();
})();
