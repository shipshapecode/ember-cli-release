/* jshint node:true */

var GitRepo = require('../utils/git');
var chalk   = require('chalk');

module.exports = {
  name: 'release',
  description: 'Create a new git tag at HEAD',
  works: 'insideProject',

  strategies: {
    semver: require('../strategies/semver'),
    date: require('../strategies/date')
  },

  availableOptions: [
    {
      name: 'local',
      type: Boolean,
      aliases: [ 'l' ],
      default: false,
      description: "whether release commit and tags are locally or not (not pushed to a remote)"
    },
    {
      name: 'remote',
      type: String,
      aliases: [ 'r' ],
      default: 'origin',
      description: "the git origin to push tags to, ignored if the '--local' option is true"
    },
    {
      name: 'tag',
      type: String,
      aliases: [ 't' ],
      description: "the name of the git tag to create"
    },
    {
      name: 'annotation',
      type: String,
      aliases: [ 'a' ],
      description: "a message passed to the `--message` option of `git tag`, indicating that to the tag should be created with the `--annotated` option (defualt is lightweight), the string '%@' is replaced with the tag name"
    },
    {
      name: 'yes',
      type: Boolean,
      aliases: [ 'y' ],
      default: false,
      description: "whether to skip confirmation prompts or not (answer 'yes' to all questions)"
    },
    {
      name: 'strategy',
      type: String,
      aliases: [ 's' ],
      default: 'semver',
      description: "strategy for auto-generating the tag name, either 'semver' or 'date', ignored if the 'name' option is specified"
    },
    {
      name: 'major',
      type: Boolean,
      aliases: [ 'j' ],
      description: "when strategy is 'semver', specifies that the major version number should be incremented"
    },
    {
      name: 'minor',
      type: Boolean,
      aliases: [ 'i' ],
      description: "when strategy is 'semver', specifies that the minor version number should be incremented, ignored if '--major' option is true"
    },
    {
      name: 'format',
      type: String,
      aliases: [ 'f' ],
      default: 'YYYY.MM.DD',
      description: "when strategy is 'date', the format used to generate the tag"
    },
    {
      name: 'timezone',
      type: String,
      aliases: [ 'z' ],
      default: 'UTC',
      description: "when strategy is 'date', the timezone to consider the current date in"
    }
  ],

  run: function(options) {
    var ui = this.ui;
    var repo = this.git();
    var versioningStrategy = this.getVersioningStrategy(options);

    return repo.currentTag().then(function(currentTag) {
      if (currentTag) {
        throw "Skipped tagging, HEAD already at tag: " + currentTag;
      }

      if (options.tag) {
        // Use tag name if specified
        return {
          next: options.tag
        };
      } else {
        // Otherwise fetach all tags to pass to the versioning strategy
        return repo.tags().then(function(tags) {
          var tagNames = tags.map(function(tag) {
            return tag.name;
          });

          return versioningStrategy(tagNames, options);
        });
      }
    }).then(function(versions) {
      if (versions.latest) {
        ui.writeLine(chalk.green('Latest version: ' + versions.latest));
      }

      if (options.yes) {
        return versions.next;
      }

      return ui.prompt({
        type: 'confirm',
        name: 'proceed',
        message: chalk.yellow("About to create tag '" + versions.next + "'" + (options.local ? "" : " and push to remote '" + options.remote + "'") + ", proceed?"),
        choices: [
          { key: 'y', value: true },
          { key: 'n', value: false }
        ]
      }).then(function(response) {
        if (!response.proceed) {
          throw "Aborted.";
        }

        return versions.next;
      });
    }).then(function(tagName) {
      var message = null;

      if (options.annotation) {
        // Allow the tag name to be in the message
        message = options.annotation.replace(/%@/g, tagName);
      }

      return repo.createTag(tagName, message).then(function() {
        if (!options.local) {
          return repo.pushTags(options.remote);
        }
      }).then(function() {
        ui.writeLine(chalk.green("Succesfully created git tag '" + tagName + "'" + (options.local ? "" : " and pushed to remote '" + options.remote + "'") + "."));
      });
    }).catch(function(error) {
      if (typeof error === 'string') {
        ui.writeLine(chalk.red(error));
      } else {
        throw error;
      }
    });
  },

  git: function() {
    if (this._repo) {
      return this._repo;
    }

    return this._repo = new GitRepo(this.project.root);
  },

  getVersioningStrategy: function(options) {
    var strategies = this.strategies;
    var strategyName = options.strategy;

    if (!(strategyName in strategies)) {
      throw "Unknown versioning strategy: '" + strategyName + "'";
    }

    return strategies[strategyName];
  }
};
