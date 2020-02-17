/**
 * @file Set predefined cookies in the browser before browsing starts
 * @author BitnessWise <https://www.bitnesswise.com/>
 * @copyright European Data Protection Supervisor (2019)
 * @license EUPL-1.2
 */

// jshint esversion: 8

const fs = require('fs');
const logger = require('./logger');
const argv = require('./argv');

module.exports.set_cookies = async function(page, uri_ins) {
  // check if cookies need to be added
  if (argv.setCookie) {
    // variable that will buffer all the valid cookies that are passed
    let cookieJar = [];
    if (fs.existsSync(argv.setCookie)) {
      // passed argument is the location of a file
      logger.log('info', `read cookie parameter from the existing file: ${argv.setCookie}`);
      let requestedDomain, protocol;
      // TODO: isn't uri_ins always starting with http?
      if (uri_ins.startsWith('http')) {
        requestedDomain = uri_ins.split('/')[2];
        protocol = uri_ins.split(':')[0];
      }
      else {
        requestedDomain = uri_ins.split('/')[0];
        protocol = "http";
      }
      // cookiefile should be small, so reading it into memory
      const lines = fs.readFileSync(argv.setCookie, 'UTF-8').trim().split(/\r?\n/);
      for(let line of lines) {
        if (line.trim().indexOf('#') == 0) {
          // this line is a comment; not parsing it
          continue;
        }
        let cookieArr = line.split('\t');
        if (cookieArr.length == 7) {
          if (cookieArr[0] != requestedDomain || (protocol == "http" && cookieArr[3])) {
            logger.info('info', `${line} doesn't match the requested domain or http url when cookie is https-only`);
            continue;
          }

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
            value: cookieArr[6],
            expires: cookieArr[4] == "0" ? cookieDefaultExpirationTime : cookieArr[4],
            url: protocol+'://'+cookieArr[0]+cookieArr[2],
            name: cookieArr[5]
          });
        }
        else {
          logger.log('error', 'invalid formatted line - skipping it : '+line);
        }
      }
    }
    else {
      logger.log('info', 'cookie parameter is not an existing file; parsing it as key=value pairs');
      let jarArr = argv.setCookie.split(";");
      for (let cookieStr of jarArr) {
        if (cookieStr.indexOf("=") >= 0) {
          let cookieName = cookieStr.split(/=(.+)/)[0], cookieValue = cookieStr.split(/=(.+)/)[1];
          cookieJar.push({
            value: cookieValue,
            expires: cookieDefaultExpirationTime,
            url: uri_ins,
            name: cookieName
          });
        }
      }
    }
    // adding cookies from the buffer if we have them
    for (var c in cookieJar) {
      var cookie = cookieJar[c];
      logger.log('info', `presetting cookie: ${cookie.name}=${cookie.value} for request ${cookie.url} with expiration ${cookie.expires}`);
      await page.setCookie({
        "value": cookie.value,
        "expires": cookie.expires,
        "url": cookie.url,
        "name": cookie.name
      });
    }
  }
};
