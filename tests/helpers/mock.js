/* jshint node:true */

'use strict';

var RSVP = require('rsvp');

function Mock(constructor) {
  var mock = this;
  var callbacks = {};
  var proto = constructor.prototype;
  var className = constructor.toString();
  var methodNames = [];
  var propNames = [];

  Object.keys(proto).forEach(function(propName) {
    if (typeof proto[propName] === 'function') {
      // Ignore the constructor
      if (proto[propName] !== proto) {
        methodNames.push(propName);
      }
    } else {
      propNames.push(propName);
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

  propNames.forEach(function(propName) {
    Object.defineProperty(mock, propName, {
      get: function() {
        var propCallbacks = callbacks[propName];

        if (!propCallbacks || !propCallbacks.length) {
          throw new Error(className + " getter '" + propName + "' called but no handler was provided");
        }

        var value = propCallbacks.shift().apply(null, arguments);

        return value;
      },
      enumerable: true,
    });
  });
}

module.exports = Mock;
