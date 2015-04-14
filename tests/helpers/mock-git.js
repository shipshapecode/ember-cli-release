/* jshint node:true */

'use strict';

var RSVP = require('rsvp');
var GitRepo = require('../../lib/utils/git');

function MockRepo() {
  this._callbacks = {};
}

var MockRepoPrototype = MockRepo.prototype;
var GitRepoPrototype = GitRepo.prototype;

var repoMethods = [];

Object.keys(GitRepoPrototype).forEach(function(methodName) {
  // Ignore the constructor
  if (GitRepoPrototype[methodName] !== GitRepo) {
    repoMethods.push(methodName);
  }
});

MockRepoPrototype.respondTo = function(methodName, callback) {
  if (!this._callbacks[methodName]) {
    this._callbacks[methodName] = [];
  }

  this._callbacks[methodName].push(callback);
};

repoMethods.forEach(function(methodName) {
  MockRepoPrototype[methodName] = function() {
    var callbacks = this._callbacks[methodName];

    if (!callbacks || !callbacks.length) {
      throw new Error("MockGit method '" + methodName + "' called but no handler was provided");
    }

    var response = callbacks.shift().apply(null, arguments);

    return RSVP.Promise.resolve(response);
  };
});

module.exports = MockRepo;
