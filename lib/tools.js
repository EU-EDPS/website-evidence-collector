// jshint esversion: 8

module.exports.safeJSONParse = function (obj) {
  try {
    return JSON.parse(obj);
  } catch(e) {
    return obj;
  }
};
