/* jshint node:true */

var semver    = require('semver');
var tagPrefix = require('../utils/tag-prefix');

function semverStrategy(tags, options) {
  var versions, latestVersion, nextVersion, releaseType;

  versions = tags.filter(function(tagName) {
    return semver.valid(tagPrefix.strip(tagName));
  }).sort(function(a, b) {
    return semver.compare(tagPrefix.strip(a), tagPrefix.strip(b));
  }).reverse();

  if (tags.length && !versions.length) {
    throw "The repository has no tags that are SemVer compliant, you must specify a tag name with the --tag option.";
  }

  if (versions.length) {
    if (options.major) {
      releaseType = 'major';
    } else if (options.minor) {
      releaseType = 'minor';
    } else {
      releaseType = 'patch';
    }

    latestVersion = versions[0];
    nextVersion = semver.inc(tagPrefix.strip(latestVersion), releaseType);

    // If tags use prefixes, append it to the new tag
    if (tagPrefix.has(latestVersion)) {
      nextVersion = tagPrefix.prepend(nextVersion);
    }
  } else {
    nextVersion = 'v0.1.0';
  }

  return {
    latest : latestVersion,
    next   : nextVersion
  };
}

module.exports = semverStrategy;
