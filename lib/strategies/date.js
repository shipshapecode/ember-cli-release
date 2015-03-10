/* jshint node:true */

var moment = require('moment-timezone');

function dateStrategy(tags, options) {
  var format = options.format || 'YYYY.MM.DD';
  var timezone = options.timezone || 'UTC';
  var now = dateStrategy.getCurrentDate();
  var tagName = moment(now).tz(timezone).format(format);
  var patch = 0;

  while (true) {
    if (tags.indexOf(appendPatch(tagName, patch)) === -1) { break; }
    patch++;
  }

  return {
    next: appendPatch(tagName, patch)
  };
}

// For testing :(
dateStrategy.getCurrentDate = function() {
  return Date.now();
};

function appendPatch(tag, patch) {
  return patch ? tag + '.' + patch : tag;
}

module.exports = dateStrategy;