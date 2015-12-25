/* jshint node:true */

var moment = require('moment-timezone');

module.exports = {
  availableOptions: [
    {
      name: 'format',
      type: String,
      aliases: [ 'f' ],
      default: 'YYYY.MM.DD',
      description: "when strategy is 'date', the format used to generate the tag",
      validInConfig: true,
    },
    {
      name: 'timezone',
      type: String,
      aliases: [ 'z' ],
      default: 'UTC',
      description: "when strategy is 'date', the timezone to consider the current date in",
      validInConfig: true,
    },
  ],

  getNextTag: function dateStrategyNextTag(project, tags, options) {
    var format = options.format || 'YYYY.MM.DD';
    var timezone = options.timezone || 'UTC';
    var now = this.getCurrentDate();
    var tagName = moment(now).tz(timezone).format(format);
    var patch = 0;

    while (true) {
      if (tags.indexOf(appendPatch(tagName, patch)) === -1) { break; }
      patch++;
    }

    return {
      next: appendPatch(tagName, patch)
    };
  },

  // Expose for testing :(
  getCurrentDate: function() {
    return Date.now();
  }
};

function appendPatch(tag, patch) {
  return patch ? tag + '.' + patch : tag;
}
