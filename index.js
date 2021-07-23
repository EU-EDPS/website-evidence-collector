const collector = require('./lib/collector');

// default options when running as a node script
const defaultOptions = {
  overwrite: true,
  quiet: true,
  screenshots: false,
  firstPartyUri: [],
  max: 0,
  sleep: 3000,
  headless: true,
  dnt: false,
  dntJs: false,
  headers: {}, // { name: 'value', }
  output: false, // './output',
  yaml: false,
  json: false,
  html: false,
  taskDescription: null,
  browserOptions: [],
  lang: 'en',
  pageTimeout: 0,
  // setCookie: <name=string/file> Cookie string or file to read cookies from
  setCookie: undefined,
}

async function run(uri, options = {}) {
  if (typeof uri !== 'string' || !uri.startsWith('http')) {
    throw new Error('You must provide an HTTP(S) URI as first argument');
  }
  
  return collector(uri, { ...defaultOptions, ...options });
}

module.exports = run;