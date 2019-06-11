// jshint esversion: 8

const { safeJSONParse } = require('./tools');
const cookieParser = require('tough-cookie').Cookie;
const fs = require('fs');
const logger = require('./logger');

module.exports.setup_cookie_recording = async function(page) {

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
        let host = window.location.hostname;
        window.reportEvent("Cookie.JS", stack, value, host);

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
          hash[prop] = value;
          let host = window.location.hostname;
          window.reportEvent("Storage.LocalStorage", stack, hash, host);
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
            hash[args[0]] = args[1];
            window.reportEvent("Storage.LocalStorage", stack, hash);
            ls.setItem.apply(ls, args);
          };
        }
      })
    });
  });

  await page.exposeFunction('reportEvent', (type, stack, data, host) => {
    let event = {
      type: type,
      stack: stack.slice(1,3), // remove reference to Document.set (0) and keep two more elements (until 3)
    };
    let message;
    switch(type) {
      case 'Cookie.JS':
        event.raw = data;
        let cookie = cookieParser.parse(data);
        if(!cookie.domain) {
          // what is the domain if not set explicitly?
          // https://stackoverflow.com/a/5258477/1407622
          cookie.domain = host;
        }
        event.data = [cookie];
        message = `${event.data[0].expires ? 'Persistant' : 'Session'} Cookie (JS) set for host ${event.data[0].domain} with key ${event.data[0].key}.`;
        break;
      case 'Storage.LocalStorage':
        message = `LocalStorage filled with keys ${Object.keys(data)}.`;
        event.raw = data;
        event.data = {};
        for(const key of Object.keys(data)) {
          event.data[key] = safeJSONParse(data[key]);
        }
        break;
      default:
        message = '';
        event.data = data;
    }

    logger.log('warn', message, event);
  });

  // track incoming traffic for HTTP cookies
  page.on('response', response => {
    const req = response.request();
    // console.log(req.method(), response.status(), req.url());

    let cookieHTTP = response._headers['set-cookie'];
    if(cookieHTTP) {
      let stack = [{
        fileName: req.url(),
        source: `set in Set-Cookie HTTP response header for ${req.url()}`,
      }];
      let splitCookieHeaders = cookieHTTP.split("\n");
      let data = splitCookieHeaders.map(cookieParser.parse);
      let message = `${data.length} Cookie(s) (HTTP) set for host ${data[0].domain} with key(s) ${data.map(c => {return c.key;}).join(', ')}.`;

      logger.log('warn', message, {
        type: "Cookie.HTTP",
        stack: stack,
        raw: cookieHTTP,
        data: data,
      });
    }
  });

};
