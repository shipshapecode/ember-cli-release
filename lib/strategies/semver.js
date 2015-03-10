/* jshint node:true */

var semver = require('semver');

function semverStrategy(tags, options) {
  var versions, latestVersion, nextVersion, releaseType;

  versions = tags.filter(function(tagName) {
    return semver.valid(stripPrefix(tagName));
  }).sort(function(a, b) {
    return semver.compare(stripPrefix(a), stripPrefix(b));
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
    nextVersion = semver.inc(stripPrefix(latestVersion), releaseType);

    // If tags use prefixes, append it to the new tag
    if (hasPrefix(latestVersion)) {
      nextVersion = prependPrefix(nextVersion);
    }
  } else {
    nextVersion = 'v0.1.0';
  }

  return {
    latest : latestVersion,
    next   : nextVersion
  };
}

var defaultPrefix = 'v';

function hasPrefix(tag, prefix) {
  return tag[0] === (prefix || defaultPrefix);
}

function stripPrefix(tag, prefix) {
  return tag.replace(new RegExp('^' + (prefix || defaultPrefix)), '');
}

function prependPrefix(tag, prefix) {
  return (prefix || defaultPrefix) + tag;
}

module.exports = semverStrategy;