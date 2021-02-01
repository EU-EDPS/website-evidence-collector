# Frequently Asked Questions

## Installation and Use

#### Why does the installation with `npm install` fail with ‘permision denied’?

#### How can I install the website evidence collector if I do not have root/administrator permission or do not want to employ root/administrator permission?

The website evidence collector is a bundled as a *node package* and is installed
using the *node package manager* (NPM). NPM installs by default packages to a
system directory and requires for this root/administrator permission. NPM can be configured to install packages in other directories that do not require special permission.

For Linux or Mac, NPM provides [a guide in its documentation](https://docs.npmjs.com/resolving-eacces-permissions-errors-when-installing-packages-globally):

1. On the command line, in your home directory, create a directory for global installations:

       mkdir ~/.npm-global

2. Configure npm to use the new directory path:

       npm config set prefix '~/.npm-global'

3. In your preferred text editor, open or create a `~/.profile` file and add this line:

       export PATH=~/.npm-global/bin:$PATH

4. On the command line, update your system variables:

       source ~/.profile

5. With this new configuration, install the website evidence collector globally without special permissions, e.g. from GitHub:

       npm install --global https://github.com/EU-EDPS/website-evidence-collector/tarball/latest

Instead of steps 1-3, you can use the corresponding ENV variable (e.g. if you don’t want to modify ~/.profile):

    NPM_CONFIG_PREFIX=~/.npm-global

**More Resources:**

- <https://docs.npmjs.com/resolving-eacces-permissions-errors-when-installing-packages-globally>

#### How do I launch Chrome if no usable sandbox is found?

If you launch the website evidence collector and receive the following error message,
than the integrated browser has an issue.

    (node:16103) UnhandledPromiseRejectionWarning: Error: Failed to launch chrome!
    [1007/151121.724510:FATAL:zygote_host_impl_linux.cc(116)] No usable sandbox! Update your kernel or see https://chromium.googlesource.com/chromium/src/+/master/docs/linux_suid_sandbox_development.md for more information on developing with the SUID sandbox. If you want to live dangerously and need an immediate workaround, you can try using --no-sandbox.

Different solutions can help here. If the website evidence collector is launched within a contained system, such as a virtual image, you can just pass the proposed option. For this, consider the following example:

    website-evidence-collector --quiet --yaml https://example.com -- --no-sandbox

Options after `--` are passed over to the integrated browser.

**More Resources:**

- <https://chromium.googlesource.com/chromium/src/+/master/docs/linux_suid_sandbox_development.md>

#### What is TestSSL and what is the TestSSL integration?

The free-software tool [TestSSL.sh](https://testssl.sh/) provides an on-premise solution to the cloud service <https://www.ssllabs.com/ssltest/>. Likewise, TestSSL.sh carries out tests to determine the security configuration of an HTTPS (SSL) host.

The website evidence collector provides two options to embed the TestSSL.sh results into its output.

1. With the option `--testssl [TestSSL.sh script]` and the location of the script as argument, the website evidence collector calls TestSSL.sh and embeds the results.
2. With the option `--testssl-file [TestSSL.sh JSON file]` and a JSON log file from a previous TestSSL.sh call, the website evidence collector embeds the file directly.

The website evidence collector has been tested to work with TestSSL.sh in version 3.0rc5.

#### How do I gather evidence of many websites in parallel? (advanced users)

If you use the option `--browse-link` or `--max`, then the website evidence collector checks multiple web pages one after another. The tool uses the same browser profile with its cookies for all pages. Some data, such as the list of links, is only stored for the page visited first.

For some use cases, it is interesting to scan web pages independently or to scan pages in parallel.

**Option 1)** The company OVH provides the specialised tool [website-evidence-collector-batch](https://github.com/ovh/website-evidence-collector-batch) to scan with the website-evidence-collector many web pages fast in parallel. A common output file for all pages summarises the findings.

**Option 2)** The tool [GNU Parallel](https://www.gnu.org/software/parallel/) allows to run any command in parallel. If you have a plain text file `links.txt` with one link in every line, you can let `parallel` build the commands for you and call them in parallel. Unlike in option 1, the output is not yet aggregated.

    parallel --bar --results log --joblog jobs.log website-evidence-collector --quiet --task-description \'\{\"job\":{#}\}\' --output job_{#} {1} :::: links.txt

CSV files can also be processed by `parallel`. This allows to add data from a CSV file to the output of the website evidence collector. CSV fields can be accessed using the placeholders `{1}`, `{2}` and so on. Consider also the option `--csv`.

    parallel --bar --results log --joblog jobs.log --colsep '\t' website-evidence-collector --quiet --task-description \'\{\"job\":{#},\"parent\":{1}\}\' --output job_{#} {2} :::: input_full_parent_url.csv

A few options allow to resume or retry unfinished or crashed call. From the manual:

- `--resume-failed` cares about the exit code, but also only looks at Seq number to figure out which commands to run. Again this means you can change the command, but not the arguments. It will run the failed seqs and the seqs not yet run.
- `--retry-failed` ignores the command and arguments on the command line: It only looks at the joblog.

If `--overwrite` shall be used to delete existing output of crashed calls, then it is better to use `--resume-failed` and change the command accordingly.

Note for zsh users: The command may require prefixing with the switch `noglob` or disabling of `globbing` to work.

    noglob parallel --bar ...

**More Resources:**

- <https://www.gnu.org/software/parallel/man.html> (GNU Parallel manual)

#### How do I gather evidence with given consent?

If a particular website stores given user consent in a cookie and the encoding of consent in the cookie value is known, than the software can pre-install such a consent cookie. The website receives this consent cookie and would assume from the beginning of the browsing session that consent has been obtained.

The developer tools integrated in most browsers (e.g. [Firefox](https://developer.mozilla.org/en-US/docs/Tools/Storage_Inspector), [Chrome](https://developers.google.com/web/tools/chrome-devtools/storage/cookies)) can help to find out in which cookie a particular website stores consent decisions.

The website https://edps.europa.eu/ (as of March 2020) encodes given consent in a cookie named `edp_cookie_agree` with value `1` and for rejected consent with value `0`. The following examples demonstrate the configuration for the website evidence collector:

    website-evidence-collector --set-cookie "edp_cookie_agree=1" http://edps.europa.eu
    website-evidence-collector --set-cookie "edp_cookie_agree=0" http://edps.europa.eu

The configuration is compatible with the cookie option (`--cookie` or `-b`) of the command line tool `curl` (cf. curl [manual page](https://curl.haxx.se/docs/manpage.html#-b)). Hence, the configuration allows to pre-install multiple cookies at the same time and to read cookies from local files.

    website-evidence-collector --set-cookie "edp_cookie_agree=1;foo=bar" http://edps.europa.eu
    website-evidence-collector --set-cookie "cookiejar.txt" http://edps.europa.eu

**More Resources:**

- <https://curl.haxx.se/docs/manpage.html#-b>
- <https://curl.haxx.se/docs/http-cookies.html>

## Evaluation of the Output

#### Which applications do you recommend to open and display the output?

- YAML files (`*.yml`) and JSON files (`*.json`) are in structured text format and can be opened with any text editor. If there is a problem with line breaks, better try a more advanced text editor. Examples are:

  - [Atom Editor](https://atom.io/) for Linux, MacOS and Windows
  - [Notebook++](https://notepad-plus-plus.org/) for Windows
  - [Kate](https://kate-editor.org/) for Linux (and also MacOS and Windows)

- JSON files can also be opened using modern Web browsers like Firefox.
- Image files (here only `*.png`) can be opened with any image view bundled with your operating system and with modern Web browsers.
- HAR files (`*.har`) can be opened with modern web browsers. For this, open the web developer toolbar, switch to the network tab and drag'n'drop the HAR file in here.

#### How do I change the `User-Agent` request header?

The website evidence collector uses a user agent header of Chrome that is defined in the top of the file `website-evidence-collector.js`. However, the value can be overwritten any other value, e.g. `WEC`:

1. `WEC_BROWSER_OPTIONS="--user-agent=WEC" website-evidence-collector https://example.com`
2. `website-evidence-collector https://example.com -- --user-agent=WEC`

**Note:** The website may behave differently with different user agent headers.

#### What is the meaning of the files and directories in the output?

The website evidence collector stores a number of files in an output directory unless the option `--no-output` has been used. The following files are stored:

```
├── beacons.yml
├── browser-profile (directory)
├── cookies.yml
├── inspection.html
├── inspection.json
├── inspection-log.ndjson
├── inspection.yml
├── local-storage.yml
├── requests.har
├── screenshot-bottom.png
├── screenshot-full.png
├── screenshot-top.png
└── websockets-log.json
```

- The `inspection.yml` contains data in the YAML format on
  - the equipment, time and configuration of the evidence collection,
  - beacons,
  - cookies and localstorage,
  - links in categories *internal*, *external*, *social media*, and
  - hosts.
- The `inspection.json` has the same content as `inspection.yml`, but in JSON format.
- The `inspection.html` can be open in the browser to print a report or safe a PDF version it with the most relevant information from `inspection.yml`. The option `--html-template` allows to switch to a custom [pug template](https://pugjs.org). Please ensure that the screenshot images are the same folder as the HTML file.
- The `beacons.yml` contains the subset on beacons from `inspection.yml`.
- The `cookies.yml` contains the subset on cookies from `inspection.yml`.
- The `local-storage.yml` contains the subset on [localStorage](https://en.wikipedia.org/wiki/LocalStorage) from `inspection.yml`
- The `websockets-log.json` contains data transferred via websockets.
- The `requests.har` in [HTTP Archive Format](https://en.wikipedia.org/wiki/HAR_(file_format) ) contains occurred HTTP requests and answers.

  Note that websocket connections are not captured and the completeness and accuracy of the file has not yet been verified.
- The `inspection-log.ndjson` is line-delimited JSON file with all log messages that the website evidence collector produced during operation.
- The screenshot files are captured from the first visited page.
- The directory `browser-profile` contains the browser profile used during evidence collection.

  Note that for every call of the website evidence collector, a fresh profile is generated.

#### How do I extract data fields and produce lists from one or multiple evidence files automatically? (advanced users)

The tool [jq](https://stedolan.github.io/jq/) for Linux, OS X and Windows allows to extract and manipulate data from json files easily. For your inspiration, a few recipes are mentioned here below.

1. coloured output of the inspection data:

       jq . output/inspection.json

2. coloured output with paging and search using [less](https://en.wikipedia.org/wiki/Less_(Unix)) (Linux and OS X only)

       jq -C . output/inspection.json | less -R

3. extract all third-party hosts

       jq '.hosts | map_values(.thirdParty)' output/inspection.json

4. extract cookies with an expiration of one day or more

       jq '.cookies[] | select(.expiresDays >= 1)'  output/inspection.json

5. list cookies with name, domain, web page and source

       jq '.cookies | map({name, domain, location: .log.location?, source: (.log.stack | first).fileName})' output/inspection.json

For a quick overview, the website evidence collector data can feed JSON data on Linux and OS X directly to `jq` without storing files in between.

    website-evidence-collector --quiet --no-output --json http://www.example.com | jq '.cookies | map({name, domain, location: .log.location?, source: (.log.stack | first).fileName})'

For extraction across multiple files, the file structure in output folders `job_1`, `job_2`, etc. is assumed as provided by `parallel` described above.

1. display all unique cookie hosts in a sorted flat list

       jq -s 'map(.hosts.cookies[]) | flatten | unique | sort' job_*/inspection.json

2. display all cookie hosts with their inspection URL and task description

       jq -s 'map({uri_ins, details: .task_description, cookie_hosts: .hosts.cookies})' job_*/inspection.json

3. display cookie names with and sorted by their occurance

       jq -s 'map({uri_ins, cookie: (.cookies | map(.name))[]}) | group_by(.cookie) | sort_by(-length) | map({name: first.cookie, occurance: length})' job_*/inspection.json

4. display which cookie has been found how often, by which website and sort results by occurrence

       jq -s 'map({uri_ins, details: .task_description, cookie: (.cookies | map({name,expiresDays,domain,value,log}))[]}) | group_by(.cookie.name) | sort_by(-length) | map({name: first.cookie.name, occurance: length, example: first.cookie, websites: map({uri_ins,details})})' job_*/inspection.json

5. display which website connects to a particular domain `example.com` and its subdomains

       jq -s 'map(select(.hosts.requests | add | any(contains("example.com")))) | map({uri_ins,task_description})' job_*/inspection.json


Afterwards, the output may be converted with [json2csv](https://www.npmjs.com/package/json2csv) from JSON to CSV to use any spreadsheet application to produce printable tables and e.g. bar charts.

**More Resources:**

- <https://stedolan.github.io/jq/manual/>
- <https://www.privacy-wise.com/website-evidence-collector>
- <https://www.npmjs.com/package/json2csv>
- <https://jqplay.org/> (`jq` online)

#### Do you offer guidelines on how to interpret the collected evidence?

The website evidence collector helps you to collect evidence for your own legal assessment. The categories of collected data were initially chosen to serve the assessment carried out by the EDPS and evolve based on feedback and contributions. The retrieved data is quickly introduced in this FAQ.

The tool is written to serve in various legal contexts and avoids suggestions towards a legal assessment. Though, some data protection authorities provide specific guidelines on how to apply data protection rules to websites in their jurisdiction.
