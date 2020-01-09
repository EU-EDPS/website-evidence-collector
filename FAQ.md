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

## Evaluation of the Output

#### Which applications do you recommend to open and display the output?

- YAML files (`*.yml`) and JSON files (`*.json`) are in structured text format and can be opened with any text editor. If there is a problem with line breaks, better try a more advanced text editor. Examples are:

  - [Atom Editor](https://atom.io/) for Linux, MacOS and Windows
  - [Notebook++](https://notepad-plus-plus.org/) for Windows
  - [Kate](https://kate-editor.org/) for Linux (and also MacOS and Windows)

- JSON files can also be opened using modern Web browsers like Firefox.
- Image files (here only `*.png`) can be opened with any image view bundled with your operating system and with modern Web browsers.
- HAR files (`*.har`) can be opened with modern web browsers. For this, open the web developer toolbar, switch to the network tab and drag'n'drop the HAR file in here.

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

  Note that for every use of the website evidence collector, a fresh profile is generated.

#### Do you offer guidelines on how to interpret the collected evidence?

The website evidence collector helps you to collect evidence for your own legal assessment. The categories of collected data were initially chosen to serve the assessment carried out by the EDPS and evolve based on feedback and contributions. The retrieved data is quickly introduced in this FAQ.

The tool is written to serve in various legal contexts and avoids suggestions towards a legal assessment. Though, some data protection authorities provide specific guidelines on how to apply data protection rules to websites in their jurisdiction.
