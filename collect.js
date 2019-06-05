#!/usr/bin/env node
// jshint esversion: 8

var argv = require('yargs') // TODO use rather option('o', hash) syntax and define default top-level command
  .scriptName('collect.js')
  .usage('Usage: $0 <URI> [options]')
  .example('$0 https://example.com/about -b example.com -b cdn.ex.com')
  // top-level default command, see https://github.com/yargs/yargs/blob/master/docs/advanced.md#default-commands
  .demandCommand(1, 'An URI for inspection is mendatory.') // ask for command and for inspection url
  .alias('m', 'max')
  .nargs('m', 1)
  .describe('m', 'Sets maximum number of random links for browsing')
  .number('m')

  // seeding is apparently not supported TODO
  // .alias('s', 'seed')
  // .nargs('s', 1)
  // .describe('s', 'Sets seed for random choice of links for browsing')
  // .number('m')

  .alias('b', 'base')
  .nargs('b', 1)
  .describe('b', 'First-party hosts for links and pages')
  .array('b')

  .alias('l', 'browse-link')
  .nargs('l', 1)
  .describe('l', 'Adds URI to list of links for browsing')
  .array('l')

  .describe('headless', 'Hides the browser window')
  .boolean('headless')
  .default('headless', true)

  .alias('y', 'yaml')
  .describe('y', 'Filename to output YAML (`-` for STDOUT)')
  .nargs('y', 1)

  .alias('j', 'json')
  .describe('j', 'Filename to output JSON (`-` for STDOUT)')
  .nargs('j', 1)
  // .default('j', '-')

  .alias('s', 'save-screenshots')
  .describe('s', 'Save screenshots as top.png, bottom.png and full.png')
  .boolean('s')
  .default('s', 0)

  .describe('mime-check', 'Excludes non-HTML pages from browsing')
  .boolean('mime-check')
  .default('mime-check', true)

  .describe('lang', 'Change the browser language')
  .default('lang', 'en')

  .help('h')
  .alias('h', 'help')
  .epilog('Copyright European Union 2019, licensed under EUPL-1.2 (see LICENSE.txt)')
  .argv;

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

const logger = require('./lib/logger');
const { setup_cookie_recording } = require('./lib/setup-cookie-recording');
const { setup_beacon_recording } = require('./lib/setup-beacon-recording');
const { setup_websocket_recording } = require('./lib/setup-websocket-recording');



const uri_ins = argv._[0];
const uri_ins_host = url.parse(uri_ins).hostname;
var uri_bases = [].concat(argv.b || []);
if (!uri_ins.match(/\bwww\./)) {
  uri_bases.push(`www.${uri_ins_host}`);
}

(async() => {
  const browser = await puppeteer.launch({
    headless: argv.headless,
    defaultViewport: {
      width: WindowSize.width,
      height: WindowSize.height,
    },
    args: [
      `--user-agent=${UserAgent}`,
      `--window-size=${WindowSize.width},${WindowSize.height}`
    ],
  });

  output = {
    uri_ins: uri_ins,
    uri_ref: argv.b && argv.b[0] || uri_ins,
    uri_dest: null,
    uri_redirects: null,
    // The key difference between url.host and url.hostname is that url.hostname
    // does not include the port.
    host: uri_ins_host,
    uri_bases: uri_bases,
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
      version: await browser.version(),
      user_agent: await browser.userAgent(),
      platform: {
        name: os.type(),
        version: os.release(),
      },
    },
    start_time: new Date(),
    end_time: null,
    webpage: {
      screenshots: null
    }
  };

  const page = await browser.newPage();
  await page.bringToFront();

  page.on('console', msg => logger.log('debug', msg.text(), {type: 'browser.console'}));

  // setup tracking
  await setup_cookie_recording(page);
  setup_beacon_recording(page);
  let webSocketLog = setup_websocket_recording(page);

  const har = new PuppeteerHar(page);
  await har.start({ path: 'requests.har' });

  logger.log('info', `browsing now to ${uri_ins}`, {type: 'browser'});

  let page_response = await page.goto(uri_ins, {waitUntil : 'networkidle2' });
  output.uri_redirects = page_response.request().redirectChain().map(req => {return req.url()});

  output.uri_dest = output.uri_redirects

  await page.waitFor(3000); // wait 3 seconds

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

  // console.dir({
  //   cookies: cookies.cookies,
  //   links: links,
  // }, {'maxArrayLength': null});

  // await page.screenshot({path: 'example.png'});

  await har.stop();

  await browser.close();

  // reporting
  fs.writeFileSync('websockets-log.json', JSON.stringify(webSocketLog, null, 2));

  if (argv.yaml) {
    let yaml_dump = yaml.safeDump(output);
    if (argv.yaml == '-') {
      console.log(yaml_dump);
    } else {
      fs.writeFileSync(argv.yaml, yaml_dump);
    }
  }

  if (argv.json) {
    let json_dump = JSON.stringify(webSocketLog, null, 2);
    if (argv.json == '-') {
      // console.log(output);
      console.dir(output, {maxArrayLength: null, depth: null});
    } else {
      fs.writeFileSync(argv.json, json_dump);
    }
  }

  // console.dir(reportedEvents, {maxArrayLength: null, depth: null});
})();
