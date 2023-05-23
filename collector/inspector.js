// jshint esversion: 8

const uniqWith = require("lodash/uniqWith");
const fs = require("fs-extra");
const yaml = require("js-yaml");
const path = require("path");
const url = require("url");
const escapeRegExp = require("lodash/escapeRegExp");

const {
  isFirstParty,
  getLocalStorage,
  safeJSONParse,
} = require("../lib/tools");

async function collectLinks(page, logger) {
  // get all links from page
  const links_with_duplicates = await page.evaluate(() => {
    return [].map
      .call(Array.from(document.querySelectorAll("a[href]")), (a) => {
        const href = a.href.toString();
        if (href === '[object SVGAnimatedString]') {
          logger.log('warn', 'Unsupported SVG link detected and discarded', a);
        }
        return {
          href: href.split("#")[0], // link without fragment
          inner_text: a.innerText,
          inner_html: a.innerHTML.trim(),
        };
      })
      .filter((link) => {
        return link.href.startsWith("http");
      });
  });

  // https://lodash.com/docs/4.17.15#uniqWith
  const links = uniqWith(links_with_duplicates, (l1, l2) => {
    // consider URLs equal if only fragment (part after #) differs.
    return l1.href.split("#").shift() === l2.href.split("#").shift();
  });

  return links;
}

async function mapLinksToParties(links, hosts, refs_regexp) {
  const output = { thirdParty: [], firstParty: [] };

  for (const li of links) {
    const l = url.parse(li.href);

    if (isFirstParty(refs_regexp, l)) {
      output.firstParty.push(li);
      hosts.links.firstParty.add(l.hostname);
    } else {
      output.thirdParty.push(li);
      hosts.links.thirdParty.add(l.hostname);
    }
  }

  return output;
}

async function filterSocialPlatforms(links) {
  // prepare regexp to match social media platforms
  let social_platforms = yaml
    .load(
      fs.readFileSync(
        path.join(__dirname, "../assets/social-media-platforms.yml"),
        "utf8"
      )
    )
    .map((platform) => {
      return escapeRegExp(platform);
    });
  let social_platforms_regexp = new RegExp(
    `\\b(${social_platforms.join("|")})\\b`,
    "i"
  );

  return links.filter((link) => {
    return link.href.match(social_platforms_regexp);
  });
}

async function filterKeywords(links) {
  let keywords = yaml
    .load(
      fs.readFileSync(path.join(__dirname, "../assets/keywords.yml"), "utf8")
    )
    .map((keyword) => {
      return escapeRegExp(keyword);
    });
  let keywords_regexp = new RegExp(keywords.join("|"), "i");

  return links.filter((link) => {
    return (
      link.href.match(keywords_regexp) || link.inner_html.match(keywords_regexp)
    );
  });
}

async function unsafeWebforms(page) {
  return await page.evaluate(() => {
    return [].map
      .call(Array.from(document.querySelectorAll("form")), (form) => {
        return {
          id: form.id,
          action: new URL(form.getAttribute("action"), form.baseURI).toString(),
          method: form.method,
        };
      })
      .filter((form) => {
        return form.action.startsWith("http:");
      });
  });
}
async function collectCookies(page, start_time) {
  // example from https://stackoverflow.com/a/50290081/1407622
  const cookies = (await page._client().send("Network.getAllCookies")).cookies
    .filter((cookie) => {
      // work-around: Chromium retains cookies with empty name and value
      // if web servers send empty HTTP Cookie Header, i.e. "Set-Cookie: "
      return cookie.name != "";
    })
    .map((cookie) => {
      if (cookie.expires > -1) {
        // add derived attributes for convenience
        cookie.expiresUTC = new Date(cookie.expires * 1000);
        cookie.expiresDays =
          Math.round((cookie.expiresUTC - start_time) / (10 * 60 * 60 * 24)) /
          100;
      }

      cookie.domain = cookie.domain.replace(/^\./, ""); // normalise domain value

      return cookie;
    });

  return cookies;
}

async function beacons() {}

module.exports = {
  collectLinks,
  collectCookies,
  filterSocialPlatforms,
  filterKeywords,
  unsafeWebforms,
  mapLinksToParties,
};
