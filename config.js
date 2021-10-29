function cfg(url) {
  return {
    url: url,
    max: 0,
    sleep: 3000,
    firstPartyUri: [],
    headless: true,
    dnt: false,
    dntJs: false,
    output: "./output",
    overwrite: false,
    yaml: true,
    json: true,
    html: true,
    taskDescription: null,
    quiet: false,
    browserOptions: [],
    lang: "en",
    pageTimeout: 0,
    screenshots: true,
  };
}

module.exports = cfg;
