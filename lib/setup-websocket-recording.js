/**
 * @file Setup recording of WebSocket traffic
 * @author Robert Riemann <robert.riemann@edps.europa.eu>
 * @copyright European Data Protection Supervisor (2019)
 * @license EUPL-1.2
 */

// jshint esversion: 8

const { safeJSONParse } = require("./tools");
//const logger = require("./logger");

module.exports.setup_websocket_recording = function (page, logger) {
  // recording websockets
  // https://stackoverflow.com/a/54110660/1407622
  var webSocketLog = {};
  const client = page._client();

  client.on("Network.webSocketCreated", ({ requestId, url }) => {
    if (!webSocketLog[requestId]) {
      webSocketLog[requestId] = {
        timestamp: new Date(),
        url: url,
        messages: [],
      };
    }
    logger.log("warn", `WebSocket opened with url ${url}`, {
      type: "WebSocket",
    });
    // console.log('Network.webSocketCreated', requestId, url);
  });

  client.on("Network.webSocketClosed", ({ requestId, timestamp }) => {
    // console.log('Network.webSocketClosed', requestId, timestamp);
  });

  client.on(
    "Network.webSocketFrameSent",
    ({ requestId, timestamp, response }) => {
      webSocketLog[requestId].messages.push({
        timestamp: timestamp,
        io: "out",
        m: response.payloadData.split("\n").map(safeJSONParse),
      });
      // console.log('Network.webSocketFrameSent', requestId, timestamp, response.payloadData);
    }
  );

  client.on(
    "Network.webSocketFrameReceived",
    ({ requestId, timestamp, response }) => {
      webSocketLog[requestId].messages.push({
        timestamp: timestamp,
        io: "in",
        m: response.payloadData.split("\n").map(safeJSONParse),
      });
      // console.log('Network.webSocketFrameReceived', requestId, timestamp, response.payloadData);
    }
  );

  return webSocketLog;
};
