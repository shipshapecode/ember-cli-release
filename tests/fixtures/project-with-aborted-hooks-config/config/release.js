/* jshint node:true */
var RSVP = require('rsvp');

module.exports = {
  init: function(project, versions) {
    if (versions.next === 'immediate') {
      throw 'nope';
    }

    if (versions.next === 'promise') {
      return RSVP.reject('nope');
    }

    return RSVP.resolve('yep');
  }
};
