/**
 * @file Set predefined cookies in the browser before browsing starts
 * @author BitnessWise <https://www.bitnesswise.com/> and European Data Protection Supervisor
 * @copyright European Data Protection Supervisor (2019)
 * @license EUPL-1.2
 */

// jshint esversion: 8

const fs = require("fs");

// default cookie expiration time, this should result in a session-cookie
const sessionCookieExpirationTime = -1;

module.exports.set_cookies = async function (
  page,
  uri_ins,
  args,
  output,
  logger
) {
  // check if cookies need to be added
  if (args.setCookie) {
    // variable that will buffer all the valid cookies that are passed
    let cookieJar = [];
    if (fs.existsSync(args.setCookie)) {
      // passed argument is the location of a file
      logger.log(
        "info",
        `Read cookie parameter from the existing file: ${args.setCookie}`
      );
      let requestedDomain, protocol;

      // TODO: isn't uri_ins always starting with http?
      if (uri_ins.startsWith("http")) {
        requestedDomain = uri_ins.split("/")[2];
        protocol = uri_ins.split(":")[0];
      } else {
        requestedDomain = uri_ins.split("/")[0];
        protocol = "http";
      }
      // cookiefile should be small, so reading it into memory
      const lines = fs
        .readFileSync(args.setCookie, "UTF-8")
        .trim()
        .split(/\r?\n/);

      for (let line of lines) {
        httpOnly = false;
        if (line.trim().substring(0, 10) == "#HttpOnly_") {
          // cookie that is flagged as http-only. stripping the flag so we can match the domain later on.
          line = line.trim().substring(10);
          httpOnly = true;
        } else if (line.trim().indexOf("#") == 0) {

          // this line is a comment; not parsing it
          continue;
        } else if (line.trim() == "") {
          // this is a blank line; ignoring it
          continue;
        }

        let cookieArr = line.split("\t");
        if (cookieArr.length == 7) {
          // valid line, adding cookie
          /***
           * Netscape cookie file format, equal to how curl uses it:
           *
           * 0 | string  | example.com | Domain name
           * 1 | boolean | FALSE       | Include subdomains
           * 2 | string  | /foobar/    | Path
           * 3 | boolean | TRUE        | Send/receive over HTTPS only
           * 4 | number  | 1462299217  | Expires at – seconds since Jan 1st 1970, or -1
           * 5 | string  | person      | Name of the cookie
           * 6 | string  | daniel      | Value of the cookie
           */

          // add to the buffer
          cookieJar.push({
            name: cookieArr[5],
            value: cookieArr[6],
            expires:
              cookieArr[4] == "0"
                ? sessionCookieExpirationTime
                : parseInt(cookieArr[4]),
            domain: cookieArr[0],
            path: cookieArr[2],
            secure: cookieArr[3].toLowerCase() == "true" ? true : false,
          });
        } else {
          logger.log("error", "invalid formatted line - skipping it : " + line);
        }
      }
    } else {
      logger.log(
        "info",
        "cookie parameter is not an existing file; parsing it as key=value pairs"
      );

      let jarArr = args.setCookie.split(";");

      for (let cookieStr of jarArr) {
        if (cookieStr.indexOf("=") >= 0) {
          let cookieName = cookieStr.split(/=(.+)/)[0],
            cookieValue = cookieStr.split(/=(.+)/)[1];
          cookieJar.push({
            value: cookieValue,
            expires: sessionCookieExpirationTime,
            url: uri_ins,
            name: cookieName,
          });
        }
      }
      
    }
    // adding cookies from the buffer if we have them
    if (cookieJar.length > 0) {
      for (var c in cookieJar) {
        logger.log(
          "info",
          "adding " +
            (cookieJar[c].expires >= 0 ? "persistant" : "session") +
            " cookie " +
            cookieJar[c].name
        );
      }
      output.browser.preset_cookies = cookieJar;
      // https://pptr.dev/#?product=Puppeteer&version=v2.1.1&show=api-pagesetcookiecookies
      await page.setCookie(...cookieJar);
    }
  }
};
