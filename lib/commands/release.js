/* jshint node:true */

var GitRepo   = require('../utils/git');
var tagPrefix = require('../utils/tag-prefix');
var fs        = require('fs');
var path      = require('path');
var chalk     = require('chalk');
var merge     = require('merge');
var makeArray = require('make-array');
var nopt      = require('nopt');
var RSVP      = require('rsvp');
var SilentError = require('silent-error');

var Promise = RSVP.Promise;
var resolve = RSVP.resolve;
var resolveAll = RSVP.all;

var configPath = 'config/release.js';

var validHooks = [
  'init',
  'beforeCommit',
  'afterPush',
];

var validConfigOptions = [
  'local',
  'remote',
  'annotation',
  'message',
  'manifest',
  'strategy',
  'format',
  'timezone',
];

var availableOptions = [
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
    description: "a message passed to the `--message` option of `git tag`, indicating that to the tag should be created with the `--annotated` option (default is lightweight), the string '%@' is replaced with the tag name"
  },
  {
    name: 'message',
    type: String,
    aliases: [ 'm' ],
    default: 'Released %@',
    description: "a message passed to the `--message` option of `git commit`, the string '%@' is replaced with the tag name"
  },
  {
    name: 'manifest',
    type: Array,
    default: [ 'package.json', 'bower.json' ],
    description: "a set of JSON files to replace the top-level `version` property in with the new tag name"
  },
  // {
  //   name: 'build',
  //   type: Boolean,
  //   aliases: [ 'b' ],
  //   default: false,
  //   description: "whether to run `ember build` or not"
  // },
  // {
  //   name: 'publish',
  //   type: Boolean,
  //   aliases: [ 'p' ],
  //   default: false,
  //   description: "whether to run `npm publish` post-tagging or not"
  // },
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
];

var allOptionNames = availableOptions.map(function(option) {
  return option.name;
});

var optionTypeMap = availableOptions.reduce(function(result, option) {
  if (~validConfigOptions.indexOf(option.name)) {
    result[option.name] = option.type;
  }

  return result;
}, {});

function hasModifications(status) {
  var modifications = status.split('\n').filter(function(str) {
    return !!str && str.indexOf('??') !== 0;
  });

  return !!modifications.length;
}

module.exports = {
  name: 'release',
  description: 'Create a new git tag at HEAD',
  works: 'insideProject',

  strategies: {
    semver: require('../strategies/semver'),
    date: require('../strategies/date')
  },

  run: function(cliOptions) {
    var ui = this.ui;
    var project = this.project;
    var projectRoot = project.root;
    var repo = this.git();
    var strategies = this.strategies;
    var pushQueue = [];

    var options = cliOptions;
    var hooks = this.config().hooks;

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
          throw new SilentError("Aborted.");
        }
      });
    }

    function getVersioningStrategy() {
      var strategyName = options.strategy;

      if (!(strategyName in strategies)) {
        throw new SilentError("Unknown versioning strategy: '" + strategyName + "'");
      }

      return strategies[strategyName];
    }

    function abortIfAtTag() {
      return repo.currentTag().then(function(currentTag) {
        if (currentTag) {
          throw new SilentError("Skipped tagging, HEAD already at tag: " + currentTag);
        }
      });
    }

    function promptIfWorkingTreeDirty() {
      return repo.status().then(function(status) {
        if (hasModifications(status)) {
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
          var versioningStrategy = getVersioningStrategy();
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
      options.manifest.forEach(function(file) {
        var filepath = path.join(projectRoot, file);

        if (fs.existsSync(filepath)) {
          var pkg = JSON.parse(fs.readFileSync(filepath, {
            encoding: 'utf8'
          }));

          // Skip replace if 'version' key does not exist
          if (pkg.version) {
            // Don't use the 'v' tag prefix for manifest file versions
            pkg.version = tagPrefix.strip(nextVersion);

            var contents = JSON.stringify(pkg, null, 2) + '\n';

            fs.writeFileSync(filepath, contents, {
              encoding: 'utf8'
            });
          }
        }
      });
    }

    function createCommit(nextVersion) {
      return repo.status().then(function(status) {
        // Don't bother committing if for some reason the working tree is clean
        if (hasModifications(status)) {
          return repo.currentBranch().then(function(branchName) {
            if (!branchName) {
              throw new SilentError("Must have a branch checked out to commit to");
            }

            // Allow the name to be in the message
            var message = options.message.replace(/%@/g, nextVersion);

            return repo.commitAll(message).then(function() {
              pushQueue.push(branchName);
            }).then(function() {
              ui.writeLine(chalk.green("Successfully committed changes '" + message + "' locally."));
            });
          });
        }
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
        pushQueue.push(tagName);
      }).then(function() {
        ui.writeLine(chalk.green("Successfully created git tag '" + tagName + "' locally."));
      });
    }

    function pushChanges() {
      if (options.local || !pushQueue.length) { return; }

      return resolveAll(pushQueue.map(function(treeish) {
        return repo.push(options.remote, treeish).then(function() {
          ui.writeLine(chalk.green("Successfully pushed '" + treeish + "' to remote '" + options.remote + "'."));
        });
      }));
    }

    function executeHook(hookName /* ...args */) {
      var args = [].slice.call(arguments, 1);
      var hook = hooks[hookName];

      // The first arg to all hooks is the project
      args.unshift(project);

      if (hook) {
        return new Promise(function(resolve, reject) {
          // Handle errors thrown directly from hook
          try {
            resolve(hook.apply(hooks, args));
          } catch(error) {
            reject(error);
          }
        }).catch(function(error) {
          // Preserve stack traces in hook errors if a real error is thrown,
          // otherwise wrap friendly errors in `SilentError`
          if (!(error instanceof Error)) {
            error = new SilentError(error);
          }

          // Provide more context in the error message
          error.message = "Error encountered in `" + hookName + '` hook: "' + error.message + '"';

          throw error;
        });
      } else {
        return resolve();
      }
    }

    return resolve()
      .then(abortIfAtTag)
      .then(getNextTag)
      .then(function(versions) {
        return executeHook('init', versions)
          .then(promptIfWorkingTreeDirty)
          .then(function() {
            printLatestVersion(versions.latest);
            replaceVersionsInManifests(versions.next);

            return executeHook('beforeCommit', versions)
              .then(function() {
                return createCommit(versions.next);
              })
              .then(function() {
                return promptToCreateTag(versions.next);
              })
              .then(function() {
                return createTag(versions.next);
              })
              .then(pushChanges)
              .then(function() {
                return executeHook('afterPush', versions);
              });
          });
      });
  },

  init: function() {
    var optionsFromConfig = this.config().options;
    var mergedOptions = availableOptions.map(function(availableOption) {
      var option = merge(true, availableOption);

      if ((optionsFromConfig[option.name] !== undefined) && (option.default !== undefined)) {
        option.default = optionsFromConfig[option.name];
        option.description = option.description + ' (configured in ' + configPath + ')';
      }

      return option;
    });

    this.registerOptions({
      availableOptions: mergedOptions
    });
  },

  git: function() {
    if (this._repo) {
      return this._repo;
    }

    return this._repo = new GitRepo(this.project.root);
  },

  config: function() {
    var ui = this.ui;

    if (!this._parsedConfig) {
      var config = {};

      if (fs.existsSync(path.join(this.project.root, configPath))) {
        config = require(path.join(this.project.root, configPath));
      }

      // Extract hooks
      var hooks = validHooks.reduce(function(result, hookName){
        if (typeof config[hookName] === 'function') {
          result[hookName] = config[hookName];
          delete config[hookName];
        } else if (config[hookName] !== undefined) {
          ui.writeLine(chalk.yellow("Warning: `" + hookName + "` is not a function in " + configPath + ", ignoring"));
        }

        return result;
      }, {});


      // Extract whitelisted options
      var options = Object.keys(config).reduce(function(result, optionName) {
        if (~validConfigOptions.indexOf(optionName)) {
          result[optionName] = optionTypeMap[optionName] === Array ? makeArray(config[optionName]) : config[optionName];
        } else if (~allOptionNames.indexOf(optionName)) {
          ui.writeLine(chalk.yellow("Warning: cannot specify option `" + optionName + "` in " + configPath + ", ignoring"));
        } else {
          ui.writeLine(chalk.yellow("Warning: invalid option `" + optionName + "` in " + configPath + ", ignoring"));
        }

        return result;
      }, {});

      // Coerce options into their expected type; this is not done for us since
      // the options are not coming from the CLI arg string
      nopt.clean(options, optionTypeMap);

      this._parsedConfig = {
        options: options,
        hooks: hooks
      };
    }

    return this._parsedConfig;
  }
};
