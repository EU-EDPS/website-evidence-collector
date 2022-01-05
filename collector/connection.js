// jshint esversion: 8

const url = require("url");
const got = require("got");
const fs = require("fs-extra");
const os = require("os");
const path = require("path");

async function testSSL(uri, args, logger, output) {
  if (args.testssl) {
    let uri_ins_https = new url.URL(uri);
    uri_ins_https.protocol = "https:";

    let testsslExecutable = args.testsslExecutable || "testssl.sh"; // set default location
    let testsslArgs = [
      "--ip one", // speed up testssl: just test the first DNS returns (useful for multiple IPs)
      "--quiet", // no banner
      "--hints", // additional hints to findings
      "--fast", // omits some checks: using openssl for all ciphers (-e), show only first preferred cipher.
      "--vulnerable", // tests vulnerabilities (if applicable)
      "--headers", // tests HSTS, HPKP, server/app banner, security headers, cookie, reverse proxy, IPv4 address
      "--protocols", // checks TLS/SSL protocols (including SPDY/HTTP2)
      "--standard", // tests certain lists of cipher suites by strength
      "--server-defaults", // displays the server's default picks and certificate info
      "--server-preference", // displays the server's picks: protocol+cipher
    ];

    let json_file;

    if (args.output) {
      let output_testssl = path.join(args.output, "testssl");
      fs.mkdirSync(output_testssl);

      json_file = `${output_testssl}/testssl.json`;
      testsslArgs.push(`--htmlfile ${output_testssl}/testssl.html`);
      testsslArgs.push(`--logfile ${output_testssl}/testssl.log`);
    } else {
      // case with --no-ouput and --testssl
      json_file = path.join(os.tmpdir(), `testssl.${Date.now()}.json`);
    }

    testsslArgs.push(`--jsonfile-pretty ${json_file}`);
    testsslArgs.push(uri_ins_https.toString());

    const { execSync } = require("child_process");
    try {
      let cmd = `${testsslExecutable} ${testsslArgs.join(" ")}`;
      logger.log("info", `launching testSSL: ${cmd}`, { type: "testSSL" });
      execSync(cmd);
    } catch (e) {
      if (e.status > 200) {
        // https://github.com/drwetter/testssl.sh/blob/3.1dev/doc/testssl.1.md#exit-status
        logger.log("warn", e.message.toString(), { type: "testSSL" });
        output.testSSLError = e.message.toString();
        output.testSSLErrorOutput = e.stderr.toString();
      }
      output.testSSLErrorCode = e.status;
    }

    if (fs.existsSync(json_file)) {
      output.testSSL = JSON.parse(fs.readFileSync(json_file, "utf8"));
    }

    if (!args.output) {
      fs.removeSync(json_file);
    }
  } else if (args.testsslFile) {
    output.testSSL = JSON.parse(fs.readFileSync(args.testsslFile), "utf8");
  }
}

async function testHttps(uri, output) {
  // test if server responds to https
  let uri_ins_https;

  try {
    uri_ins_https = new url.URL(uri);
    uri_ins_https.protocol = "https:";

    await got(uri_ins_https, {
      followRedirect: false,
    });

    output.secure_connection.https_support = true;
  } catch (error) {
    output.secure_connection.https_support = false;
    output.secure_connection.https_error = error.toString();
  }

  // test if server redirects http to https
  try {
    let uri_ins_http = new url.URL(uri);
    uri_ins_http.protocol = "http:";

    let res = await got(uri_ins_http, {
      followRedirect: true,
      // ignore missing/wrongly configured SSL certificates when redirecting to
      // HTTPS to avoid reporting SSL errors in the output field http_error
      https: {
        rejectUnauthorized: false,
      },
    });

    output.secure_connection.redirects = res.redirectUrls;

    if (output.secure_connection.redirects.length > 0) {
      let last_redirect_url = new url.URL(
        output.secure_connection.redirects[
          output.secure_connection.redirects.length - 1
        ]
      );
      output.secure_connection.https_redirect =
        last_redirect_url.protocol.includes("https");
    } else {
      output.secure_connection.https_redirect = false;
    }
  } catch (error) {
    output.secure_connection.http_error = error.toString();
  }
}

module.exports = { testHttps, testSSL };
