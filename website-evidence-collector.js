#!/usr/bin/env node
// jshint esversion: 8

/**
 * @file Collects evidence from websites on processed data in transit and at rest.
 * @author Robert Riemann <robert.riemann@edps.europa.eu>
 * @copyright European Data Protection Supervisor (2019)
 * @license EUPL-1.2
 */

const argv = require('./lib/argv');

const UserAgent = "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/72.0.3617.0 Safari/537.36";
const WindowSize = {
  width: 1680,
  height: 927, // arbitrary value close to 1050
};

const puppeteer = require('puppeteer');
const PuppeteerHar = require('puppeteer-har');
const fs = require('fs-extra');
const os = require('os');
const url = require('url');
const yaml = require('js-yaml');
const path = require('path');
const pug = require('pug');
const request = require('request-promise-native');
const {gitDescribeSync} = require('git-describe');

const logger = require('./lib/logger');
const { setup_cookie_recording } = require('./lib/setup-cookie-recording');
const { setup_beacon_recording } = require('./lib/setup-beacon-recording');
const { setup_websocket_recording } = require('./lib/setup-websocket-recording');
const escapeRegExp = require('lodash/escapeRegExp');
const groupBy = require('lodash/groupBy');
const flatten = require('lodash/flatten');
const sampleSize = require('lodash/sampleSize');

const { isFirstParty, getLocalStorage } = require('./lib/tools');

const uri_ins = argv._[0];
const uri_ins_host = url.parse(uri_ins).hostname; // hostname does not include port unlike host

var uri_refs = [uri_ins].concat(argv.firstPartyUri);

let uri_refs_stripped = uri_refs.map((uri_ref) => {
  let uri_ref_parsed = url.parse(uri_ref);
  return escapeRegExp(`${uri_ref_parsed.hostname}${uri_ref_parsed.pathname.replace(/\/$/, "")}`);
});

var refs_regexp = new RegExp(`^(${uri_refs_stripped.join('|')})\\b`, 'i');

(async() => {
  if (argv.output) {
    if (fs.existsSync(argv.output)) {
      fs.removeSync(argv.output);
    }
    fs.mkdirSync(argv.output);
  }

  const browser = await puppeteer.launch({
    headless: argv.headless,
    defaultViewport: {
      width: WindowSize.width,
      height: WindowSize.height,
    },
    userDataDir: argv.output ? path.join(argv.output, 'browser-profile') : undefined,
    args: [
      `--user-agent=${UserAgent}`,
      `--window-size=${WindowSize.width},${WindowSize.height}`,
    ].concat(argv._.slice(1)),
  });

  // prepare hash to store data for output
  output = {
    title: argv.title || `Website Evidence Collection`,
    uri_ins: uri_ins,
    uri_refs: uri_refs,
    uri_dest: null,
    uri_redirects: null,
    secure_connection: {},
    host: uri_ins_host,
    script: {
      host: os.hostname(),
      version: {
        npm: require('./package.json').version,
        commit: null,
      },
      cmd_args: process.argv.slice(2).join(' '),
      node_version: process.version,
    },
    browser: {
      name: "Chromium",
      version: (await browser.version()),
      user_agent: (await browser.userAgent()),
      platform: {
        name: os.type(),
        version: os.release(),
      },
    },
    start_time: new Date(),
    end_time: null,
  };

  // log git version if git is installed
  try {
    const gitInfo = gitDescribeSync(__dirname);
    output.script.version.commit = gitInfo.raw;
  } catch (e) {}

  const page = (await browser.pages())[0];

  // forward logs from the browser console
  page.on('console', msg => logger.log('debug', msg.text(), {type: 'Browser.Console'}));

  // setup tracking
  await setup_cookie_recording(page);
  await setup_beacon_recording(page);
  let webSocketLog = setup_websocket_recording(page);
  let hosts = {
    requests: {
      firstParty: new Set(),
      thirdParty: new Set(),
    },
    beacons: {
      firstParty: new Set(),
      thirdParty: new Set(),
    },
    cookies: {
      firstParty: new Set(),
      thirdParty: new Set(),
    },
    localStorage: {
      firstParty: new Set(),
      thirdParty: new Set(),
    },
    links: {
      firstParty: new Set(),
      thirdParty: new Set(),
    },
  };

  // record all requested hosts
  await page.on('request', (request) => {
    const l = url.parse(request.url());
    // note that hosts may appear as first and third party depending on the path
    if (isFirstParty(refs_regexp, l)) {
      hosts.requests.firstParty.add(l.hostname);
    } else {
      if(l.protocol != 'data:') {
        hosts.requests.thirdParty.add(l.hostname);
      }
    }
  });

  const har = new PuppeteerHar(page);
  await har.start({ path: argv.output ? path.join(argv.output, 'requests.har') : undefined });

  logger.log('info', `browsing now to ${uri_ins}`, {type: 'Browser'});

  let page_response = await page.goto(uri_ins, {timeout: 0, waitUntil : 'networkidle2' });
  output.uri_redirects = page_response.request().redirectChain().map(req => {return req.url();});

  output.uri_dest = page.url();

  // secure connection

  // test if server responds to https
  try {
    let uri_ins_https = new url.URL(uri_ins);
    uri_ins_https.protocol = 'https:';
    await request(uri_ins_https.toString(), {
      followRedirect: false,
      resolveWithFullResponse: true,
      simple: false,
    });
    output.secure_connection.https_support = true;
  } catch(error) {
    output.secure_connection.https_support = false;
    output.secure_connection.https_error = error.toString();
  }

  // test if server redirects http to https
  try {
    let uri_ins_http = new url.URL(uri_ins);
    uri_ins_http.protocol = 'http:';
    let res = await request(uri_ins_http.toString(), {
      followRedirect: true,
      resolveWithFullResponse: true,
      simple: false,
    });
    output.secure_connection.redirects = res.request._redirect.redirects.map(r => r.redirectUri);
    let last_redirect_url = new url.URL(output.secure_connection.redirects[output.secure_connection.redirects.length-1]);
    output.secure_connection.https_redirect = last_redirect_url.protocol.includes('https');
  } catch(error) {
    output.secure_connection.http_error = error.toString();
  }

  await page.waitFor(argv.sleep); // in ms
  let localStorage = await getLocalStorage(page);

  const links_with_duplicates = await page.evaluate( () => {
    return [].map.call(document.querySelectorAll('a[href]'), a => {
      return {
        href: a.href.split('#')[0], // link without fragment
        inner_text: a.innerText,
        inner_html: a.innerHTML.trim(),
      };
    }).filter(link => {
      return link.href.startsWith('http');
    });
  });

  // https://dev.to/vuevixens/removing-duplicates-in-an-array-of-objects-in-js-with-sets-3fep
  const links = Array.from(new Set(links_with_duplicates.map(link => link.href)))
  .map(href => {
    return links_with_duplicates.find(link => link.href === href);
  });

  output.links = {
    firstParty: [],
    thirdParty: [],
  };

  for (const link of links) {
    const l = url.parse(link.href);

    if (isFirstParty(refs_regexp, l)) {
      output.links.firstParty.push(link);
      hosts.links.firstParty.add(l.hostname);
    } else {
      output.links.thirdParty.push(link);
      hosts.links.thirdParty.add(l.hostname);
    }
  }

  // prepare regexp to match social media platforms
  let social_platforms = yaml.safeLoad(fs.readFileSync(path.join(__dirname, 'assets/social-media-platforms.yml'), 'utf8')).map((platform) => {
    return escapeRegExp(platform);
  });
  let social_platforms_regexp = new RegExp(`\\b(${social_platforms.join('|')})\\b`, 'i');
  output.links.social = links.filter( (link) => {
    return link.href.match(social_platforms_regexp);
  });

  // prepare regexp to match links by their href or their caption
  let keywords = yaml.safeLoad(fs.readFileSync(path.join(__dirname, 'assets/keywords.yml'), 'utf8')).map((keyword) => {
    return escapeRegExp(keyword);
  });
  let keywords_regexp = new RegExp(keywords.join('|'), 'i');
  output.links.keywords = links.filter( (link) => {
    return link.href.match(keywords_regexp) || link.inner_html.match(keywords_regexp);
  });

  // record screenshots
  if (argv.output) {
    await page.screenshot({path: path.join(argv.output, 'screenshot-full.png'), fullPage: true});
    await page.screenshot({path: path.join(argv.output, 'screenshot-top.png')});
    await page.evaluate( () => {
      window.scrollTo(0,document.body.scrollHeight);
    });
    await page.screenshot({path: path.join(argv.output, 'screenshot-bottom.png')});
  }

  // unsafe webforms
  output.unsafeForms = await page.evaluate( () => {
    return [].map.call(document.querySelectorAll('form'), form => {
      return {
        id: form.id,
        action: form.action,
        method: form.method,
      };
    }).filter(form => {
      return form.action.startsWith('http:');
    });
  });

  // browsing
  let browse_user_set = argv.browseLink || [];
  let browse_links = sampleSize(output.links.firstParty, argv.max - browse_user_set.length);
  output.browsing_history = [output.uri_dest].concat(browse_user_set, browse_links.map( l => l.href ));

  for (const link of output.browsing_history.slice(1)) {
    logger.log('info', `browsing now to ${link}`, {type: 'Browser'});
    await page.goto(link, {timeout: 0, waitUntil : 'networkidle2' });

    await page.waitFor(argv.sleep); // in ms
    localStorage = await getLocalStorage(page, localStorage);
  }


  // example from https://stackoverflow.com/a/50290081/1407622
  const cookies = (await page._client.send('Network.getAllCookies')).cookies.map( cookie => {
    if (cookie.expires > -1) {
      // add derived attributes for convenience
      cookie.expiresUTC = new Date(cookie.expires * 1000);
      cookie.expiresDays = Math.round((cookie.expiresUTC - output.start_time) / (10 * 60 * 60 * 24)) / 100;
    }

    cookie.domain = cookie.domain.replace(/^\./,''); // normalise domain value

    return cookie;
  });

  await har.stop();

  await browser.close();

  output.end_time = new Date();

  // reporting
  if (argv.output) {
    fs.writeFileSync(path.join(argv.output, 'websockets-log.json'), JSON.stringify(webSocketLog, null, 2));
  }
  output.websockets = webSocketLog;

  // analyse cookies and web beacons
  let event_data_all = await new Promise( (resolve, reject) => {
    logger.query({
      start: 0,
      order: 'desc',
      limit: Infinity,
    }, (err, results) => {
      if (err) return reject(err);
      return resolve(results.file);
    });
  });

  // filter only events with type set
  let event_data = event_data_all.filter( (event) => {
    return !!event.type;
  });

  let cookies_from_events = flatten(event_data.filter( (event) => {
    return event.type.startsWith('Cookie');
  }).map( event => {
    event.data.forEach( cookie => {
      cookie.log = {
        stack: event.stack,
        type: event.type,
        timestamp: event.timestamp,
        location: event.location,
      };
    });
    return event.data;
  }));

  cookies.forEach( cookie => {
    let matched_event = cookies_from_events.find( cookie_from_events => {
      return (cookie.name == cookie_from_events.key) &&
             (cookie.domain == cookie_from_events.domain) &&
             (cookie.path == cookie_from_events.path);
    });
    if (!!matched_event) {
      cookie.log = matched_event.log;
    }

    if (isFirstParty(refs_regexp, `cookie://${cookie.domain}${cookie.path}`)) {
      cookie.firstPartyStorage = true;
      hosts.cookies.firstParty.add(cookie.domain);
    } else {
      cookie.firstPartyStorage = false;
      hosts.cookies.thirdParty.add(cookie.domain);
    }
  });

  output.cookies = cookies.sort(function(a,b) {return b.expires-a.expires;});

  if (argv.output) {
    let yaml_dump = yaml.safeDump(cookies, {noRefs: true});
    fs.writeFileSync(path.join(argv.output, 'cookies.yml'), yaml_dump);
  }

  let storage_from_events = event_data.filter( (event) => {
    return event.type.startsWith('Storage');
  });

  Object.keys(localStorage).forEach( (origin) => {
    let hostname = new url.URL(origin).hostname;
    let isFirstPartyStorage = isFirstParty(refs_regexp, origin);
    if (isFirstPartyStorage) {
      hosts.localStorage.firstParty.add(hostname);
    } else {
      hosts.localStorage.thirdParty.add(hostname);
    }

    let originStorage = localStorage[origin];
    Object.keys(originStorage).forEach( (key) => {
      // add if entry is linked to first-party host
      originStorage[key].firstPartyStorage = isFirstPartyStorage;
      // find log for a given key
      let matched_event = storage_from_events.find( event => {
        return (origin == event.origin) &&
               Object.keys(event.data).includes(key);
      });
      if (!!matched_event) {
        originStorage[key].log = {
          stack: matched_event.stack,
          type: matched_event.type,
          timestamp: matched_event.timestamp,
          location: matched_event.location,
        };
      }
    });
  });

  output.localStorage = localStorage;
  if (argv.output) {
    let yaml_dump = yaml.safeDump(localStorage, {noRefs: true});
    fs.writeFileSync(path.join(argv.output, 'local-storage.yml'), yaml_dump);
  }

  let beacons_from_events = flatten(event_data.filter( (event) => {
    return event.type.startsWith('Request.Tracking');
  }).map( event => {
    return Object.assign({}, event.data, {
      log: {
        stack: event.stack,
        // type: event.type,
        timestamp: event.timestamp,
      }
    });
  }));

  for (const beacon of beacons_from_events) {
    const l = url.parse(beacon.url);

    if(beacon.listName == 'easyprivacy.txt') {
      if (isFirstParty(refs_regexp, l)) {
        hosts.beacons.firstParty.add(l.hostname);
      } else {
        hosts.beacons.thirdParty.add(l.hostname);
      }
    }
  }

  // make now a summary for the beacons (one of every hostname+pathname and their occurrance)
  let beacons_from_events_grouped = groupBy(beacons_from_events, beacon => {
    let url_parsed = url.parse(beacon.url);
    return `${url_parsed.hostname}${url_parsed.pathname.replace(/\/$/,'')}`;
  });

  let beacons_summary = [];
  for (const [key, beacon_group] of Object.entries(beacons_from_events_grouped)) {
    beacons_summary.push(Object.assign({}, beacon_group[0], {
      occurrances: beacon_group.length,
    }));
  }

  beacons_summary.sort( (b1, b2) => { return b2.occurances - b1.occurances;});

  output.beacons = beacons_summary;

  let arrayFromParties = function(array) {
    return {
      firstParty: Array.from(array.firstParty),
      thirdParty: Array.from(array.thirdParty),
    };
  };

  output.hosts = {
    requests: arrayFromParties(hosts.requests),
    beacons: arrayFromParties(hosts.beacons),
    cookies: arrayFromParties(hosts.cookies),
    localStorage: arrayFromParties(hosts.localStorage),
    links: arrayFromParties(hosts.links),
  };

  if (argv.output) {
    let yaml_dump = yaml.safeDump(beacons_summary, {noRefs: true});
    fs.writeFileSync(path.join(argv.output, 'beacons.yml'), yaml_dump);
  }

  if(argv.output || argv.yaml) {
    let yaml_dump = yaml.safeDump(output, {noRefs: true});

    if (argv.yaml) {
      console.log(yaml_dump);
    }

    if (argv.output) {
      fs.writeFileSync(path.join(argv.output, 'inspection.yml'), yaml_dump);
    }
  }

  if (argv.output || argv.json) {
    let json_dump = JSON.stringify(output, null, 2);

    if (argv.json) {
      console.log(json_dump);
    }

    if (argv.output) {
      fs.writeFileSync(path.join(argv.output, 'inspection.json'), json_dump);
    }
  }

  if (argv.output || argv.html) {
    let html_template = argv.html_template || path.join(__dirname, 'assets/template.pug');
    let html_dump = pug.renderFile(html_template, Object.assign({}, output, {
      pretty: true,
      basedir: __dirname,
      groupBy: groupBy,
    }));

    if (argv.html) {
      console.log(html_dump);
    }

    if (argv.output)  {
      fs.writeFileSync(path.join(argv.output, 'inspection.html'), html_dump);
    }
  }
})();
