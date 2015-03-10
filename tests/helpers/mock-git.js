/* jshint node:true */

'use strict';

var RSVP = require('rsvp');

function MockRepo() {
  this._callbacks = {};
}

var MockRepoPrototype = MockRepo.prototype;

var repoMethods = [
  'tags',
  'currentTag',
  'createTag',
  'pushTags'
];

MockRepoPrototype.respondTo = function(methodName, callback) {
  this._callbacks[methodName] = callback;
};

repoMethods.forEach(function(methodName) {
  MockRepoPrototype[methodName] = function() {
    if (typeof this._callbacks[methodName] !== 'function') {
      throw new Error("MockGit method '" + methodName + "' called but no handler was provided");
    }

    var response = this._callbacks[methodName].apply(null, arguments);

    // Make sure subsequent calls are handled
    delete this._callbacks[methodName];

    return RSVP.Promise.resolve(response);
  };
});

module.exports = MockRepo;