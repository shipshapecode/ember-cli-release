/* jshint node:true */

'use strict';

var expect = require('chai').expect;

var semverStrategy = require('../../../lib/strategies/semver');

describe("semver strategy", function() {
  var tagNames = [ '2.0.0', '2.1.0', '3.0.0', '3.0.1', '3.1.0', '3.1.1' ];
  var project = {};

  it("should provide a default tag", function() {
    var tagName = semverStrategy.getNextTag(project, [], {});

    expect(tagName).to.equal('v0.1.0');
  });

  it("should return the latest tag if available", function() {
    var tagName = semverStrategy.getLatestTag(project, tagNames, {});

    expect(tagName).to.equal('3.1.1');
  });

  it("should default to incrementing the patch version", function() {
    var tagName = semverStrategy.getNextTag(project, tagNames, {});

    expect(tagName).to.equal('3.1.2');
  });

  it("should increment the minor version", function() {
    var tagName = semverStrategy.getNextTag(project, tagNames, { minor: true });

    expect(tagName).to.equal('3.2.0');
  });

  it("should increment the minor version", function() {
    var tagName = semverStrategy.getNextTag(project, tagNames, { major: true });

    expect(tagName).to.equal('4.0.0');
  });

  it("should increment the major version and add a prerelease identifier", function() {
    var tagName = semverStrategy.getNextTag(project, tagNames, { premajor: 'alpha' });

    expect(tagName).to.equal('4.0.0-alpha.0');
  });

  it("should increment the minor version and add a prerelease identifier", function() {
    var tagName = semverStrategy.getNextTag(project, tagNames, { preminor: 'alpha' });

    expect(tagName).to.equal('3.2.0-alpha.0');
  });

  it("should add the prerelease version", function() {
    var tagName = semverStrategy.getNextTag(project, tagNames, { prerelease: 'alpha' });

    expect(tagName).to.equal('3.1.2-alpha.0');
  });

  it("should add the prerelease version if different from the current identifier", function() {
    var tagName = semverStrategy.getNextTag(project, tagNames.concat('4.0.0-alpha.0'), { prerelease: 'beta' });

    expect(tagName).to.equal('4.0.0-beta.0');
  });

  it("should increment the prerelease version", function() {
    var tagName = semverStrategy.getNextTag(project, tagNames.concat('4.0.0-alpha.0'), { prerelease: 'alpha' });

    expect(tagName).to.equal('4.0.0-alpha.1');
  });

  it("should throw if tags are present but none are semver compliant", function() {
    expect(semverStrategy.getNextTag.bind(null, project, [ 'foo' ], {})).to.throw("The repository has no tags that are SemVer compliant, you must specify a tag name with the --tag option.");
  });

  it("should add the 'v' prefix to tags if it's used in the latest tag", function() {
    var tagName = semverStrategy.getNextTag(project, [ '0.1.0', 'v0.1.1' ], {});

    expect(tagName).to.equal('v0.1.2');
  });

  it("should go through a common release cycle", function() {
    var tagNames = [ 'v0.1.0' ];
    var latestTagName, nextTagName;
    var sequence = [
      [ {},                       'v0.1.1' ],
      [ { minor: true },          'v0.2.0' ],
      [ {},                       'v0.2.1' ],
      [ {},                       'v0.2.2' ],
      [ { major: true },          'v1.0.0' ],
      [ {},                       'v1.0.1' ],
      [ { prerelease: 'beta' },   'v1.0.2-beta.0' ],
      [ {},                       'v1.0.2' ],
      [ { preminor: 'beta' },     'v1.1.0-beta.0' ],
      [ { prerelease: true },     'v1.1.0-beta.1' ],
      [ { minor: true },          'v1.1.0' ],
      [ {},                       'v1.1.1' ],
      [ { premajor: 'alpha' },    'v2.0.0-alpha.0' ],
      [ { prerelease: true },     'v2.0.0-alpha.1' ],
      [ { prerelease: 'beta' },   'v2.0.0-beta.0' ],
      [ { prerelease: true },     'v2.0.0-beta.1' ],
      [ { prerelease: true },     'v2.0.0-beta.2' ],
      [ { major: true },          'v2.0.0' ],
    ];

    for (var i = 0, l = sequence.length; i < l; i++) {
      latestTagName = semverStrategy.getLatestTag(project, tagNames, sequence[i][0]);
      nextTagName = semverStrategy.getNextTag(project, tagNames, sequence[i][0]);
      expect(latestTagName).to.equal(tagNames[i]);
      expect(nextTagName).to.equal(sequence[i][1]);
      tagNames.push(nextTagName);
    }
  });
});
