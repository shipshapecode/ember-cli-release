/* jshint node:true */

var semver    = require('semver');
var tagPrefix = require('../utils/tag-prefix');

var initialVersion = '0.1.0';

var semverStrategy = {
  availableOptions: [
    {
      name: 'major',
      type: Boolean,
      aliases: [ 'j' ],
      description: "specifies that the major version number should be incremented"
    },
    {
      name: 'minor',
      type: Boolean,
      aliases: [ 'i' ],
      description: "specifies that the minor version number should be incremented, ignored if '--major' option is true"
    },
  ],

  getLatestTag: function semverStrategyLatestTag(project, tags) {
    var versions = tags
      .map(function(tagName) {
        return tagPrefix.strip(tagName);
      })
      .filter(semver.valid)
      .sort(semver.compare)
      .reverse();

    var latestVersion = versions[0];
    var hasPrefix = tags.indexOf(tagPrefix.prepend(latestVersion)) !== -1;

    // If tags use a prefix, prepend it to the tag
    return hasPrefix ? tagPrefix.prepend(latestVersion): latestVersion;
  },

  getNextTag: function semverStrategyNextTag(project, tags, options) {
    var latestVersion, nextVersion, hasPrefix, releaseType, prereleaseFlag;
    var latestTag = semverStrategy.getLatestTag(project, tags);

    if (tags.length && !latestTag) {
      throw "The repository has no tags that are SemVer compliant, you must specify a tag name with the --tag option.";
    }

    if (latestTag) {
      if (options.major) {
        releaseType = 'major';
      } else if (options.minor) {
        releaseType = 'minor';
      } else {
        releaseType = 'patch';
      }

      latestVersion = tagPrefix.strip(latestTag);
      nextVersion = semver.inc(latestVersion, releaseType, prereleaseFlag);
      hasPrefix = tags.indexOf(tagPrefix.prepend(latestVersion)) !== -1;
    } else {
      nextVersion = initialVersion;
      hasPrefix = true;
    }

    // If tags use a prefix, prepend it to the tag
    return hasPrefix ? tagPrefix.prepend(nextVersion): nextVersion;
  }
};

module.exports = semverStrategy;
