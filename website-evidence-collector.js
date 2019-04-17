// change global directory with npm config edit
// install puppeteer globally with npm save -g puppeteer
// link puppeteer locally with npm link puppeteer

const puppeteer = require('puppeteer');


(async() => {
  const browser = await puppeteer.launch();
  const page = await browser.newPage();
  const url = process.argv[2];
  await page.goto(url, {waitUntil : 'networkidle2' });

  // example from https://stackoverflow.com/a/50290081/1407622
  // Here we can get all of the cookies
  console.log(await page._client.send('Network.getAllCookies'));

  // await page.screenshot({path: 'example.png'});

  await browser.close();
})();
