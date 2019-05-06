## HEAD

  * feature: change cookie placement locator mechanism to use injections and stacktrace.js instead of Debugger.scriptParsed for improved accuracy
  * feature: also track HTTP cookies
  * feature: record HAR file if optional 2nd commandline paramater HAR filename is set

## 0.1.0 / 2019-04-17

  * Birthday!
  * move monkey-patched code to a proper repository
  * create README.md and CHANGELOG.md
  * feature: use `Debugger.scriptParsed` and heuristical assumptions to get insights on when cookies are placed
