/* jshint node:true */

var GitRepo = require('../utils/git');
var fs      = require('fs');
var path    = require('path');
var merge   = require('merge');
var chalk   = require('chalk');
var RSVP    = require('rsvp');

var resolve = RSVP.Promise.resolve.bind(RSVP.Promise);

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
      name: 'message',
      type: String,
      aliases: [ 'm' ],
      default: 'Released %@',
      description: "a message passed to the `--message` option of `git commit`, the string '%@' is replaced with the tag name"
    },
    {
      name: 'build',
      type: Boolean,
      aliases: [ 'b' ],
      default: false,
      description: "whether to run `ember build` or not"
    },
    {
      name: 'publish',
      type: Boolean,
      aliases: [ 'p' ],
      default: false,
      description: "whether to run `npm publish` post-tagging or not"
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

  run: function(cliOptions) {
    var command = this;
    var ui = this.ui;
    var repo = this.git();
    var defaultOptions = this.availableOptions.map(function(option) {
      return option.default;
    });
    var options = {};

    if (fs.existsSync(path.join(this.project.root, 'config/release'))) {
      options = this.project.require('config/release');
    }

    options = merge(options, removeDefaults(cliOptions, defaultOptions));

    var versioningStrategy = this.getVersioningStrategy(options);

    function proceedPrompt(ui, message) {
      if (options.yes) {
        return resolve();
      }

      return ui.prompt({
        type: 'confirm',
        name: 'proceed',
        message: chalk.yellow(message + ", proceed?"),
        choices: [
          { key: 'y', value: true },
          { key: 'n', value: false }
        ]
      }).then(function(response) {
        if (!response.proceed) {
          throw "Aborted.";
        }
      });
    }

    function abortIfAtTag() {
      return repo.currentTag().then(function(currentTag) {
        if (currentTag) {
          throw "Skipped tagging, HEAD already at tag: " + currentTag;
        }
      });
    }

    function propmtIfWorkingTreeDirty() {
      return repo.status().then(function(status) {
        if (status) {
          return proceedPrompt(ui, "Your working tree contains modifications that will be added to the release commit");
        }
      });
    }

    function getNextTag() {
      if (options.tag) {
        // Use tag name if specified
        return {
          next: options.tag
        };
      } else {
        // Otherwise fetch all tags to pass to the versioning strategy
        return repo.tags().then(function(tags) {
          var tagNames = tags.map(function(tag) {
            return tag.name;
          });

          return versioningStrategy(tagNames, options);
        });
      }
    }

    function printLatestVersion(latestVersion) {
      if (latestVersion) {
        ui.writeLine(chalk.green('Latest version: ' + latestVersion));
      }
    }

    function replaceVersionsInManifests(nextVersion) {
      [ 'package.json', 'bower.json' ].forEach(function(file) {
        command.replaceVersionInFile(file, nextVersion);
      });
    }

    function promptToCreateTag(nextVersion) {
      return proceedPrompt(ui, "About to create tag '" + nextVersion + "'" + (options.local ? "" : " and push to remote '" + options.remote + "'"));
    }

    function createTag(tagName) {
      var message = null;

      if (options.annotation) {
        // Allow the tag name to be in the message
        message = options.annotation.replace(/%@/g, tagName);
      }

      return repo.createTag(tagName, message).then(function() {
        if (!options.local) {
          return repo.push(options.remote, tagName);
        }
      }).then(function() {
        ui.writeLine(chalk.green("Succesfully created git tag '" + tagName + "'" + (options.local ? "" : " and pushed to remote '" + options.remote + "'") + "."));
      });
    }

    return resolve()
      .then(abortIfAtTag)
      .then(propmtIfWorkingTreeDirty)
      .then(getNextTag)
      .then(function(versions) {
        printLatestVersion(versions.latest);

        replaceVersionsInManifests(versions.next);

        return promptToCreateTag(versions.next).then(function() {
          return createTag(versions.next);
        });
      })
      .catch(function(error) {
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

  replaceVersionInFile: function(file, version) {
    var filepath = path.join(this.project.root, file);

    if (fs.existsSync(filepath)) {
      var pkg = JSON.parse(fs.readFileSync(filepath, {
        encoding: 'utf8'
      }));

      // Skip replace if 'version' key does not exist
      if (pkg.version) {
        pkg.version = version;

        var contents = JSON.stringify(pkg, null, 2);

        fs.writeFileSync(filepath, contents, {
          encoding: 'utf8'
        });
      }
    }
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

function removeDefaults(obj, defaults) {
  return Object.keys(obj).reduce(function(result, key) {
    if (obj[key] !== defaults[key]) {
      result[key] = obj[key];
    }

    return result;
  }, {});
}
