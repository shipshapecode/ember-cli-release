/* jshint node:true */

'use strict';

var expect = require('chai').expect;

var semverStrategy = require('../../../lib/strategies/semver');

describe("semver strategy", function() {
  var tagNames = [ '2.0.0', '2.1.0', '3.0.0', '3.0.1', '3.1.0', '3.1.1' ];

  it("should provide a default tag", function() {
    var tag = semverStrategy([], {});

    expect(tag.next).to.equal('v0.1.0');
  });

  it("should return the latest tag if available", function() {
    var tag = semverStrategy(tagNames, {});

    expect(tag.latest).to.equal('3.1.1');
  });

  it("should default to incrementing the patch version", function() {
    var tag = semverStrategy(tagNames, {});

    expect(tag.next).to.equal('3.1.2');
  });

  it("should increment the minor version if specified", function() {
    var tag = semverStrategy(tagNames, { minor: true });

    expect(tag.next).to.equal('3.2.0');
  });

  it("should increment the minor version if specified", function() {
    var tag = semverStrategy(tagNames, { major: true });

    expect(tag.next).to.equal('4.0.0');
  });

  it("should throw if tags are present but none are semver compliant", function() {
    expect(semverStrategy.bind(null, [ 'foo' ], {})).to.throw("The repository has no tags that are SemVer compliant, you must specify a tag name with the --tag option.");
  });

  it("should add the 'v' prefix to tags if it's used in the latest tag", function() {
    var tag = semverStrategy([ '0.1.0', 'v0.1.1' ], {});

    expect(tag.next).to.equal('v0.1.2');
  });
});