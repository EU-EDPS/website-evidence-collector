// jshint esversion: 8

const fs = require('fs');

exports.page_setup = async function(page, WindowSize) {
  await page.setViewport({
    width: WindowSize.width,
    height: WindowSize.height,
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
          hash[prop] = safeJSONParse(value);
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
            hash[args[0]] = safeJSONParse(args[1]);
            window.reportEvent("Storage.LocalStorage", stack, hash);
            ls.setItem.apply(ls, args);
          };
        }
      })
    });
  });
};
