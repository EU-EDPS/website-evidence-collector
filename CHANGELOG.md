## HEAD

* fix: WEC failed to extract links from some websites, error: Cannot read properties of undefined (reading 'startsWith')
* dependencies: overwrite the dependency of `puppeteer-har` to address `npm audit` warnings
* feature: support collection of whitelisted hosts in the HTTP header Content-Security-Policy (CSP)

## 2.1.2 / 2024-04-25

* feature: support PDF output with `website-evidence-reporter` using chromium (brings the benefit of adding page title and page numbers)
* dependencies: update dependencies (`npm update`)
* fix: fix `WORKDIR` in Dockerfile (fixes #106)

## 2.1.1 / 2023-09-20

* fix: undefined variable bug when generating docx with `website-evidence-reporter` using html-to-docx
* feature: enable section numbering and table of contents in pandoc docx/odt output
* dependencies: require now node version 16 or higher (previously 14)
* fix: override marked version in package.json to 8.0.1 (instead of 4.3.0 imposed by jstransformer-marked@1.4.0) to fix custom header IDs in custom templates (workaround)
* fix: forgot to increment the version number for 2.0.0 in NPM meta data (package.json) 

## 2.1.0 / 2023-09-06

* fix: location detection for HTTP Cookies was breaking the WEC when response.frame() is null.
* update dependency: puppeteer with bundled Chrome v109.0.5412.0
* update: set UserAgent string to Chrome v109.0.5412.0
* fix: make recording of cookies more robust (fallback for frame url)
* fix: broken cookie support
* If html report is generated, convert it automatically to pdf; can be disabled with `--no-pdf`
* dependency: update to puppeteer 15.2.0 (Chrome/93.0.4577.0 -> Chrome/104.0.5109.0)
* fix: unresolvable paths in website-evidence-reporter
* feature: allow to load extra JSON and YAML files in extra variable (array) when generating reports with custom templates using the website-evidence-reporter
* feature: website-evidence-reporter computes the relative path to screenshots if the output file is set (option `-o`)
* fix: cookies in the event log don't have always a path attribute, so that the matching of cookies from Chrome storage and the event log failed sometimes
* feature: add Section numbers to the HTML/PDF output using CSS
* fix: logger must be passed through as argument in lib/tools.js
* feature: support dark mode via CSS `var(--color-canvas-default)`
* fix: in some occasions, the path of cookies registered in the log was wrong, so that cookies from the log and from the storage would not be matched as the same cookie
* fix: non-compliant cookie headers such as ` ; sameSite=None` with no key are discarded from the logging and matching
* feature: add clickable anchors to all sections in the html output with AnchorJS
* feature: add config object to output
* fix: improve CSS for tables (overwrite imported rules based on Github CSS) (#94)
* fix: crash when websites employ links in SVGs (PR #91)
* dependency: update the inline anchor.js library in the default HTML template
* feature: improve markdown to html conversion in the default HTML template and custom HTML templates (involves marked-smartypants, marked-custom-heading-id)
* dependency: update amongst other tough-cookie lib
* update: switch to new Headless Chrome mode (see <https://developer.chrome.com/articles/new-headless/>)
* dependency: update to puppeteer 21.1.1 (Chrome/104.0.5109.0 -> Chrome/116.0.5845.96)
* update: add www.tiktok.com to social-media-platforms.yml to increase detection rate
* update: update bundled filterlists easyprivacy.txt and fanboy-annoyance.txt to the most recent version as of 2023-09-05
* feature: also add support for docx output to `website-evidence-reporter` (includes support for `--office-template` and `--use-pandoc`). With pandoc, also odt output is supported. The output format is infered from the file ending of the output file (either html, docx, or odt).
* feature: generate automatically inspection.docx in output folder. Use `--office-template [file]` to change the respective pug template. Use `--use-pandoc` to generate the docx with [pandoc](https://pandoc.org/) (needs to be installed separately) instead of [html-to-docx](https://github.com/privateOmega/html-to-docx).

## 2.0.0 / 2022-06-30

* fix: use for Docker Alpine v3.15.0 and exclude output directory in `.dockerignore`
* update: set UserAgent string to Chrome v93.0.4577.0
* regression: temporary depreciation of `--quiet`, use on Linux/Mac `2> /dev/null` instead
* refactor: use modularisation (thank you Per Ploug)
* update: update bundled filterlists easyprivacy.txt and fanboy-annoyance.txt to the most recent version as of 2022-01-06
* update: update puppeteer version to v10.1.0
* fix: fix crash due to non-compliant cookies and log non-compliant cookies (thanks to Hamburg DPA staff!)
* update: migrate from depreciated NPM package *request* to *got*
* fix: ignore `Error: unable to verify the first certificate` during mime-type test
* fix: catch crash when `request.frame()` evaluates to `null` (some error pages).
* dependency: require node version >= 14.2.0 (released April 2020)
* update: puppeteer API calls: migrate away from `waitFor`, see https://github.com/puppeteer/puppeteer/issues/6214
* update: node dependencies, most importantly puppeteer to v7 that embeds Chromium browser to v90
* documentation: explain in FAQ how to change the `User-Agent` request header
* fix: improved support for Netscape cookie file format ([#53](https://github.com/EU-EDPS/website-evidence-collector/issues/53))
* move all console log output to STDERR
* switch console log to Newline Delimited JSON if the content is piped, e.g. with `website-evidence-collector http://test.local | cat`
* remove `pino-pretty` package for pretty-printing and related example in FAQ
* update: update bundled filterlists easyprivacy.txt and fanboy-annoyance.txt to the most recent version as of 2022-06-30

## 1.0.0 / 2021-01-07

* fix an issue when tool crashes when the browsing of multiple random pages with `--max` includes PDF files and other downloads: selected links are tested first to have mime type `text/html` using a HEAD HTTP request outside of the browser.
* bugfix: stop script and log error in case of unreachable websites
* feature: allow for custom page load timeouts, example: `--page-timeout=200` for a timeout of 200 ms.
* feature: add option `--dnt` to send DO-NOT-TRACK (DNT) HTTP header
* feature: add option `--dnt-js` to both send DO-NOT-TRACK (DNT) HTTP header and set `navigator.doNotTrack` property accordingly
* bugfix: Chromium retains cookies with empty name and value if web servers send empty HTTP Cookie Header, i.e. "Set-Cookie: "
* feature: add option `--task-description` to include custom text/JSON in the output
* bugfix: HTML output generation crashed for some websites with incomplete SSL certificates
* documentation: include tips for fast/parallel evidence collection in FAQ
* bugfix: injected JS produces error on some websites (Uncaught TypeError: this.each is not a function at NodeList.collect (prototype.js:293))
* bugfix: tool crashes sometimes if no redirects from HTTP are found
* bugfix: catch Error: Protocol error (Page.captureScreenshot): Unable to capture screenshot
* bugfix: catch Error: Protocol error (DOMStorage.getDOMStorageItems): Frame not found for the given security origin
* bugfix: tool crashes sometimes when page response is for some reason empty (TypeError: Cannot read property 'request' of null)
* bugfix: tool hangs when page has forms that contains an element with id `action`
* feature: allow to pre-install cookies with `--set-cookie` to e.g. indicate given/rejected consent
* documentation: add to FAQ tips on data analysis with shell tool `jq`
* breaking change: change commandline option name of `website-evidence-reporter` from `--output` to `--output-file` to mark the distinct meaning and avoid clash when setting `WEC_OUTPUT` environment variable (short option name stays `-o` for both)
* update: node dependencies and filterlists
* feature: respect environment variables such as `WEC_MAX=10` or `WEC_headless=false`
* feature: introduce option `--browser-options <browser options>` as an alternative to the `-- <browser options>` syntax (required for Docker setup)
* bugfix: update yargs dependency to get bugfix https://github.com/yargs/yargs-parser/issues/261 for `--browser-options` starting with double dash `--`
* feature: add commandline option `--browser-profile` (`-p`) to allow the reuse of existing browser profiles (thanks to Hamburg DPA staff!)
* feature: include medium.com and tiktok.com links in social media subsection of output link list
* bugfix: handle non-zero testSSL error codes according to https://github.com/drwetter/testssl.sh/blob/3.1dev/doc/testssl.1.md#exit-status
* bugfix: catch and log error "Frame not found for the given security origin" (thanks to Hamburg DPA staff!)
* bugfix: fix CLI option to pass custom templates (https://github.com/EU-EDPS/website-evidence-collector/issues/38)

## 0.4.0 / 2020-01-17

* log web forms with non-encrypted transmission
* distinguish links and hosts between first- and third-party
* bugfix: always normalise cookie domains
* bugfix: consider URLs equal if only fragment (part after #) differs when browsing multiple pages (#16)
* feature: limit beacon hosts to requests detected by easyprivacy.txt
* feature: add computed property to cookies and local storage objects: `firstPartyStorage` is true if the cookie is stored under a first-party host (considers also cookie path)
* feature: sort cookies with respect to their expiration (all session cookies at the end)
* feature: add HTML output describing the collection alongside tables and lists with evidence
* feature: allow highlighting with doubleclick on cells and list items in HTML output
* feature: require explicit option `--overwrite` to delete existing files
* feature: allow the use of [TestSSL.sh](https://testssl.sh/) or TestSSL.sh data to enrich the evidence collection
* update: update bundled filterlists easyprivacy.txt and fanboy-annoyance.txt to the most recent version as of 2019-12-12
* update: update puppeteer version to v2.0.0
* feature: add new tool website-evidence-reporter to allow generation of HTML output from JSON output without repeating the evidence collection.

  Together with custom templates, this allows to generate different HTML reports from the same data. It also helps the development/debugging of custom templates.

## 0.3.1 / 2019-10-18

  * documentation: move from zip to tarball archives to allow for installation with `npm install`
  * documentation: add screencast videos
  * refactor: improve the integration of the adblock library provided by the browser [Cliqz](https://cliqz.com/) and better link filtered content to a specific filter in the output
  * documentation: add [FAQ.md](FAQ.md) to answer frequent questions
  * dependency: update version and provider of [puppeteer-har](https://www.npmjs.com/package/puppeteer-har) to [Remove git dependency for end-users](https://github.com/EU-EDPS/website-evidence-collector/issues/9)
  * dependency: downgrade version of tough-cookie to match version employed by chrome-har
  * documentation: add guidance to install unstable versions and to uninstall any version
  * bugfix: make json console output json compliant
  * feature: add secure connection tests

## 0.3.0 / 2019-09-25

  * refactor: rename `collect.js` to `website-evidence-collector.js`
  * feature: make npm setup a symlink to have command `website-evidence-collector` available
  * bugfix: fix bug related to URL
  * documentation: add logo

## 0.2.2 / 2019-07-30

  * bugfix: in some cases, location of JS cookies is not set in its log data
  * documentation: update README.md
  * feature: log commit version if git is installed and repository found

## 0.2.1 / 2019-07-29

  * security: update lodash
  * documentation: update data protection notice in README.md

## 0.2.0 / 2019-07-29

  * license: adopt EUPL license and add headers to relevant files
  * feature: change cookie placement locator mechanism to use injections and stacktrace.js instead of `Debugger.scriptParsed` for improved accuracy
  * feature: also track HTTP cookies
  * feature: record HAR file
  * feature: include all links in output data
  * feature: detect and report use of LocalStorage API
  * feature: employ easyprivacy list to detect potential tracking (beacons, analytics)
  * feature: avoid HeadlessChrome in `UserAgent` when sending requests
  * feature: decode LocalStorage data from JSON if possible
  * feature: record websocket traffic
  * feature: configure output options and introduce silent mode
  * feature: allow browsing of other first-party web pages

## 0.1.0 / 2019-04-17

  * Birthday!
  * move monkey-patched code to a proper repository
  * create README.md and CHANGELOG.md
  * feature: use `Debugger.scriptParsed` and heuristic assumptions to get insights on when cookies are placed
