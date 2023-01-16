/**
 * @file Setup recording of Cookie and LocalStorage API use
 * @author Robert Riemann <robert.riemann@edps.europa.eu>
 * @copyright European Data Protection Supervisor (2019)
 * @license EUPL-1.2
 */

// jshint esversion: 8

const { safeJSONParse } = require("./tools");
const cookieParser = require("tough-cookie").Cookie;
const defaultPath = require("tough-cookie").defaultPath;
const fs = require("fs");
const groupBy = require("lodash/groupBy");
const url = require("url");

module.exports.setup_cookie_recording = async function (page, logger) {
  // inject stacktraceJS https://www.stacktracejs.com/
  const stackTraceHelper = fs.readFileSync(
    require.resolve("stacktrace-js/dist/stacktrace.js"),
    "utf8"
  );

  // https://chromedevtools.github.io/devtools-protocol/tot/Page#method-addScriptToEvaluateOnNewDocument
  await page.evaluateOnNewDocument(stackTraceHelper);

  // this modifies the document.cookie object, so when a site tries to set a cookie
  // this code will intercept it, log it, and then set the cookie
  await page.evaluateOnNewDocument(() => {
    // original object
    origDescriptor = Object.getOwnPropertyDescriptor(
      Document.prototype,
      "cookie"
    );

    // new method, which will log the cookie being set, and then pass it on
    // to the original object
    Object.defineProperty(document, "cookie", {
      get() {
        return origDescriptor.get.call(this);
      },
      set(value) {
        // https://www.stacktracejs.com/#!/docs/stacktrace-js
        let stack = StackTrace.getSync({ offline: true });

        // inside our wrapper we execute the .reportEvent from within the browser
        // reportEvent is defined further down
        window.reportEvent("Cookie.JS", stack, value, window.location);
        return origDescriptor.set.call(this, value);
      },
      enumerable: true,
      configurable: true,
    });

    // inject storage set recorder
    // https://stackoverflow.com/a/49093643/1407622
    Object.defineProperty(window, "localStorage", {
      configurable: true,
      enumerable: true,
      value: new Proxy(localStorage, {
        set: function (ls, prop, value) {
          //console.log(`direct assignment: ${prop} = ${value}`);
          let stack = StackTrace.getSync({ offline: true });
          let hash = {};
          hash[prop] = value;

          // reportEvent is called within the browser context - this is defined further down
          window.reportEvent(
            "Storage.LocalStorage",
            stack,
            hash,
            window.location
          );
          ls[prop] = value;
          return true;
        },
        get: function (ls, prop) {
          // The only property access we care about is setItem. We pass
          // anything else back without complaint. But using the proxy
          // fouls 'this', setting it to this {set: fn(), get: fn()}
          // object.
          if (prop !== "setItem") {
            if (typeof ls[prop] === "function") {
              return ls[prop].bind(ls);
            } else {
              return ls[prop];
            }
          }
          return (...args) => {
            let stack = StackTrace.getSync({ offline: true });
            let hash = {};
            hash[args[0]] = args[1];
            window.reportEvent(
              "Storage.LocalStorage",
              stack,
              hash,
              window.location
            );
            ls.setItem.apply(ls, args);
          };
        },
      }),
    });
  });

  // we modify the browser window and expose the function reportEvent on window
  // this is used to pull out browser-context data and sending it our logger

  await page.exposeFunction("reportEvent", (type, stack, data, location) => {
    // determine actual browsed page
    let browsedLocation = location.href;
    if (location.ancestorOrigins && location.ancestorOrigins[0]) {
      // apparently, this is a chrome-specific API
      browsedLocation = location.ancestorOrigins[0];
    }

    // construct the event object to log
    // include the stack
    let event = {
      type: type,
      stack: stack.slice(1, 3), // remove reference to Document.set (0) and keep two more elements (until 3)
      origin: location.origin,
      location: browsedLocation,
    };

    // set the log entry message - this depends on what type of event is being logged
    // only js cookies and localstorage events should be logged here
    let message;
    switch (type) {
      case "Cookie.JS":
        event.raw = data;
        let cookie = cookieParser.parse(data);

        // what is the domain if not set explicitly?
        // https://stackoverflow.com/a/5258477/1407622
        cookie.domain = cookie.domain || location.hostname;

        // what if the path is not set explicitly?
        // https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Set-Cookie#attributes
        // https://github.com/salesforce/tough-cookie#defaultpathpath
        // TODO How can be sure that browsedLocation corresponds to the JS execution context when cookie is set?
        cookie.path = cookie.path || defaultPath(url.parse(browsedLocation).pathname);

        event.data = [cookie];

        message = `${
          event.data[0].expires ? "Persistant" : "Session"
        } Cookie (JS) set for host ${event.data[0].domain} with key ${
          event.data[0].key
        }.`;
        break;

      case "Storage.LocalStorage":
        message = `LocalStorage filled with key(s) ${Object.keys(
          data
        )} for origin ${location.origin}.`;
        event.raw = data;
        event.data = {};
        for (const key of Object.keys(data)) {
          event.data[key] = safeJSONParse(data[key]);
        }
        break;

      default:
        message = "";
        event.data = data;
    }

    logger.log("warn", message, event);
  });

  // track incoming traffic for HTTP cookies
  // this creates an event handler - should be disposed
  page.on("response", (response) => {
    const req = response.request();
    // console.log(req.method(), response.status(), req.url());

    let cookieHTTP = response.headers()["set-cookie"];
    if (cookieHTTP) {
      let stack = [
        {
          fileName: req.url(),
          source: `set in Set-Cookie HTTP response header for ${req.url()}`,
        },
      ];
      const domain = new url.URL(response.url()).hostname;
      const data = cookieHTTP
        .split("\n")
        .map((c) => {
          return cookieParser.parse(c) || { value: c };
        })
        .map((cookie) => {
          // what is the domain if not set explicitly?
          // https://stackoverflow.com/a/5258477/1407622
          cookie.domain = cookie.domain || domain;

          // what if the path is not set explicitly?
          // https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Set-Cookie#attributes
          // https://github.com/salesforce/tough-cookie#defaultpathpath
          cookie.path = cookie.path || defaultPath(new url.URL(response.url()).pathname);
          return cookie;
        });

      const dataHasKey = groupBy(data, (cookie) => {
        return !!cookie.key;
      });
      const valid = dataHasKey[true] || [];
      const invalid = dataHasKey[false] || [];

      const messages = [
        `${valid.length} Cookie(s) (HTTP) set for host ${domain}${
          valid.length ? " with key(s) " : ""
        }${valid.map((c) => c.key).join(", ")}.`,
      ];
      if (invalid.length) {
        messages.push(
          `${
            invalid.length
          } invalid cookie header(s) set for host ${domain}: "${invalid
            .map((c) => c.value)
            .join(", ")}".`
        );
      }

      // find mainframe
      let frame = response.frame();
      while (frame && frame.parentFrame()) {
        frame = frame.parentFrame();
      }
      // default to response.url() if frame() is undefined. Unclear when this happens #todo.
      // or page.url(), // (can be about:blank if the request is issued by browser.goto)
      let location = frame.url() || response.url();

      messages.forEach((message) => {
        logger.log("warn", message, {
          type: "Cookie.HTTP",
          stack: stack,
          location: location,
          raw: cookieHTTP,
          data: valid,
        });
      });
    }
  });
};
