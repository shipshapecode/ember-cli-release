/* jshint node:true */

'use strict';

var RSVP = require('rsvp');

function Mock(constructor) {
  var mock = this;
  var callbacks = {};
  var proto = constructor.prototype;
  var className = constructor.toString();

  var methodNames = [];

  Object.keys(proto).forEach(function(methodName) {
    // Ignore the constructor
    if (proto[methodName] !== proto) {
      methodNames.push(methodName);
    }
  });

  mock.respondTo = function(methodName, callback) {
    if (!callbacks[methodName]) {
      callbacks[methodName] = [];
    }

    callbacks[methodName].push(callback);
  };

  methodNames.forEach(function(methodName) {
    mock[methodName] = function() {
      var methodCallbacks = callbacks[methodName];

      if (!methodCallbacks || !methodCallbacks.length) {
        throw new Error(className + " method '" + methodName + "' called but no handler was provided");
      }

      var response = methodCallbacks.shift().apply(null, arguments);

      return RSVP.Promise.resolve(response);
    };
  });
}

module.exports = Mock;
