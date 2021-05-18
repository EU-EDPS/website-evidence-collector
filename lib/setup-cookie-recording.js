/**
 * @file Setup recording of Cookie and LocalStorage API use
 * @author Robert Riemann <robert.riemann@edps.europa.eu>
 * @copyright European Data Protection Supervisor (2019)
 * @license EUPL-1.2
 */

// jshint esversion: 8

const { safeJSONParse } = require('./tools');
const cookieParser = require('tough-cookie').Cookie;
const fs = require('fs');
const logger = require('./logger');
const url = require('url');
const groupBy = require('lodash/groupBy');

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
        window.reportEvent("Cookie.JS", stack, value, window.location);

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
          window.reportEvent("Storage.LocalStorage", stack, hash, window.location);
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
            window.reportEvent("Storage.LocalStorage", stack, hash, window.location);
            ls.setItem.apply(ls, args);
          };
        }
      })
    });
  });

  await page.exposeFunction('reportEvent', (type, stack, data, location) => {
    // determine actual browsed page
    let browsedLocation = location.href;
    if(location.ancestorOrigins && location.ancestorOrigins[0]) { // apparently, this is a chrome-specific API
      browsedLocation = location.ancestorOrigins[0];
    }

    let event = {
      type: type,
      stack: stack.slice(1,3), // remove reference to Document.set (0) and keep two more elements (until 3)
      origin: location.origin,
      location: browsedLocation,
    };
    let message;
    switch(type) {
      case 'Cookie.JS':
        event.raw = data;
        let cookie = cookieParser.parse(data);
        if(!cookie.domain) {
          // what is the domain if not set explicitly?
          // https://stackoverflow.com/a/5258477/1407622
          cookie.domain = location.hostname;
        }
        event.data = [cookie];
        message = `${event.data[0].expires ? 'Persistant' : 'Session'} Cookie (JS) set for host ${event.data[0].domain} with key ${event.data[0].key}.`;
        break;
      case 'Storage.LocalStorage':
        message = `LocalStorage filled with key(s) ${Object.keys(data)} for origin ${location.origin}.`;
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
      const domain = new url.URL(response.url()).hostname;
      const data = cookieHTTP.split("\n")
        .map(c => { return cookieParser.parse(c) || {value: c}; })
        .map(cookie => {
          // what is the domain if not set explicitly?
          // https://stackoverflow.com/a/5258477/1407622
          cookie.domain ||= domain;
          return cookie;
        });

      const dataHasKey = groupBy(data, (cookie) => {return !!cookie.key;});
      const valid = dataHasKey[true] || [];
      const invalid = dataHasKey[false] || [];

      const messages = [ `${valid.length} Cookie(s) (HTTP) set for host ${domain}${valid.length ? " with key(s) " : ""}${valid.map(c => c.key).join(', ')}.` ];
      if (invalid.length) {
        messages.push(`${invalid.length} invalid cookie header(s) set for host ${domain}: "${invalid.map(c => c.value).join(", ")}".`)
      }

      // find mainframe
      let frame = response.frame();
      while(frame.parentFrame()) {
        frame = frame.parentFrame();
      }

      messages.forEach(message => {
        logger.log('warn', message, {
          type: "Cookie.HTTP",
          stack: stack,
          location: frame.url(), // or page.url(), // (can be about:blank if the request is issued by browser.goto)
          raw: cookieHTTP,
          data: data,
        });
      })
    }
  });

};
