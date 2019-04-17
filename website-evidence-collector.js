// change global directory with npm config edit
// install puppeteer globally with npm save -g puppeteer
// link puppeteer locally with npm link puppeteer

const puppeteer = require('puppeteer');
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
  });

  // https://www.stacktracejs.com/#!/docs/stacktrace-js
  await page.exposeFunction('report_cookie_set', (value, stack) => {
    console.log("Cookie: ", value);
    stack.shift(); // remove reference to Document.set
    console.log(stack);
  });

  const url = process.argv[2];
  await page.goto(url, {waitUntil : 'networkidle2' });

  // example from https://stackoverflow.com/a/50290081/1407622
  // Here we can get all of the cookies
  console.log(await page._client.send('Network.getAllCookies'));

  // await page.screenshot({path: 'example.png'});

  await browser.close();
})();
