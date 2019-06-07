#!/usr/bin/env node
// jshint esversion: 8

const argv = require('./lib/argv');


const UserAgent = "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/72.0.3617.0 Safari/537.36";
const WindowSize = {
  width: 1680,
  height: 927, // quite arbitrary
};

const puppeteer = require('puppeteer');
const PuppeteerHar = require('puppeteer-har');
const fs = require('fs');
const os = require('os');
const url = require('url');
const yaml = require('js-yaml');
const path = require('path');

const logger = require('./lib/logger');
const { setup_cookie_recording } = require('./lib/setup-cookie-recording');
const { setup_beacon_recording } = require('./lib/setup-beacon-recording');
const { setup_websocket_recording } = require('./lib/setup-websocket-recording');
const escapeRegExp = require('lodash/escapeRegExp');
const groupBy = require('lodash/groupBy');

const { isFirstParty } = require('./lib/tools');



const uri_ins = argv._[0];
const uri_ins_host = url.parse(uri_ins).hostname;

var uri_refs = [uri_ins].concat(argv.firstPartyUri);

let uri_refs_stripped = uri_refs.map((uri_ref) => {
  let uri_ref_parsed = url.parse(uri_ref);
  return escapeRegExp(`${uri_ref_parsed.hostname}${uri_ref_parsed.pathname.replace(/\/$/, "")}`);
});

var refs_regexp = new RegExp(`\\b(${uri_refs_stripped.join('|')})\\b`, 'i');

(async() => {
  if (argv.output && !fs.existsSync(argv.output)) {
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
      `--window-size=${WindowSize.width},${WindowSize.height}`
    ],
  });

  output = {
    uri_ins: uri_ins,
    uri_refs: uri_refs,
    uri_dest: null,
    uri_redirects: null,
    // The key difference between url.host and url.hostname is that url.hostname
    // does not include the port.
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
    webpage: {},
  };

  const page = await browser.newPage();
  await page.bringToFront();

  page.on('console', msg => logger.log('debug', msg.text(), {type: 'browser.console'}));

  // setup tracking
  await setup_cookie_recording(page);
  setup_beacon_recording(page);
  let webSocketLog = setup_websocket_recording(page);

  const har = new PuppeteerHar(page);
  await har.start({ path: argv.output ? path.join(argv.output, 'requests.har') : undefined });

  logger.log('info', `browsing now to ${uri_ins}`, {type: 'browser'});

  let page_response = await page.goto(uri_ins, {waitUntil : 'networkidle2' });
  output.uri_redirects = page_response.request().redirectChain().map(req => {return req.url()});

  output.uri_dest = page.url();

  await page.waitFor(argv.sleep); // in ms

  // example from https://stackoverflow.com/a/50290081/1407622
  // Here we can get all of the cookies
  const cookies = await page._client.send('Network.getAllCookies');
  const links = await page.evaluate( () => {
    return [].map.call(document.querySelectorAll('a[href]'), a => {
      return {
        href: a.href,
        inner_text: a.innerText,
        inner_html: a.innerHTML.trim(),
      };
    }).filter(link => {
      return link.href.startsWith('http');
    });
  });

  output.webpage.links = groupBy(links, (link) => {
    return isFirstParty(refs_regexp, link.href) ? 'first_party' : 'third_party';
  });

  let social_platforms = yaml.safeLoad(fs.readFileSync('./social-media-platforms.yml', 'utf8')).map((platform) => {
    return escapeRegExp(platform);
  });
  let social_platforms_regexp = new RegExp(`\\b(${social_platforms.join('|')})\\b`, 'i');
  output.webpage.links.social = links.filter( (link) => {
    return link.href.match(social_platforms_regexp);
  });

  // console.dir({
  //   cookies: cookies.cookies,
  //   links: links,
  // }, {'maxArrayLength': null});

  if (argv.output) {
    await page.screenshot({path: path.join(argv.output, 'screenshot-full.png'), fullPage: true});
    await page.screenshot({path: path.join(argv.output, 'screenshot-top.png')});
    await page.evaluate( () => {
      window.scrollTo(0,document.body.scrollHeight);
    });
    await page.screenshot({path: path.join(argv.output, 'screenshot-bottom.png')});
  }

  await har.stop();

  await browser.close();

  output.end_time = new Date();

  // reporting
  fs.writeFileSync('websockets-log.json', JSON.stringify(webSocketLog, null, 2));

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
    if (argv.json) {
      // console.log(output);
      console.dir(output, {maxArrayLength: null, depth: null});
    }

    if (argv.output) {
      let json_dump = JSON.stringify(webSocketLog, null, 2);
      fs.writeFileSync(path.join(argv.output, 'inspection.json'), json_dump);
    }
  }

  // console.dir(reportedEvents, {maxArrayLength: null, depth: null});
  if (argv.output) {
    let reportedEvents = {};
    let json_dump = JSON.stringify(reportedEvents, null, 2);
    fs.writeFileSync(path.join(argv.output, 'events.json'), json_dump);
  }
})();
