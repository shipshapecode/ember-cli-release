/* jshint node:true */

'use strict';

var expect         = require('chai').expect;
var fs             = require('fs-extra');
var path           = require('path');
var merge          = require('merge');
var rimraf         = require('rimraf');
var MockUI         = require('ember-cli/tests/helpers/mock-ui');
var MockAnalytics  = require('ember-cli/tests/helpers/mock-analytics');
var Command        = require('ember-cli/lib/models/command');
var MockRepo       = require('../../helpers/mock-git');
var ReleaseCommand = require('../../../lib/commands/release');
var EOL            = require('os').EOL;
var RSVP           = require('rsvp');

var rootPath = process.cwd();
var fixturePath = path.join(rootPath, 'tests/fixtures');

function copyFixture(name) {
  fs.copySync(path.join(fixturePath, name), '.');
}

describe("release command", function() {
  var ui;
  var analytics;
  var project;
  var repo;

  function fileExists(filePath) {
    return fs.existsSync(path.join(project.root, filePath));
  }

  function fileContents(filePath) {
    return fs.readFileSync(path.join(project.root, filePath), { encoding: 'utf8' });
  }

  beforeEach(function() {
    ui = new MockUI();
    analytics = new MockAnalytics();
    repo = new MockRepo();

    rimraf.sync('tmp');
    fs.mkdirSync('tmp');
    process.chdir('tmp');

    // Our tests copy config fixtures around, so we need to ensure
    // each test gets the current config/release.js result
    var configPath = path.resolve('config/release.js');
    if (require.cache[configPath]) {
      delete require.cache[configPath];
    }

    project = {
      root: path.resolve('.'),
      require: function(module) {
        if (module === 'ember-cli/lib/errors/silent') {
          return Error;
        } else {
          throw new Error('Module not found (fake implementation)');
        }
      },
      hasDependencies: function () {
        return true;
      },
      isEmberCLIProject: function(){
        return true;
      }
    };
  });

  afterEach(function() {
    process.chdir(rootPath);
  });

  function makeResponder(value) {
    return function() {
      return value;
    };
  }

  function createCommand(options) {
    options || (options = {});

    merge(options, {
      ui: ui,
      analytics: analytics,
      project: project,
      environment: {},
      settings: {},
      git: function() {
        return repo;
      }
    });

    var TestReleaseCommand = Command.extend(ReleaseCommand);

    return new TestReleaseCommand(options);
  }

  describe("when HEAD is at a tag", function() {
    it("should exit immediately if HEAD is at a tag", function() {
      var cmd = createCommand();

      repo.respondTo('currentTag', makeResponder('v1.3.0'));

      return cmd.validateAndRun().catch(function(error) {
        expect(error.message).to.equals('Skipped tagging, HEAD already at tag: v1.3.0');
      });
    });
  });

  describe("when HEAD is not at a tag", function() {
    describe("when working copy has modifications", function() {
      beforeEach(function() {
        repo.respondTo('currentTag', makeResponder(null));
      });

      it("should warn of local changes and allow aborting", function() {
        var cmd = createCommand();

        ui.waitForPrompt().then(function() {
          ui.inputStream.write('n' + EOL);
        });

        repo.respondTo('tags', makeResponder([]));
        repo.respondTo('status', makeResponder(' M app/foo.js'));

        return cmd.validateAndRun([ '--local' ]).then(function() {
          expect(ui.output).to.contain("Your working tree contains modifications that will be added to the release commit, proceed?");
        }).catch(function(error) {
          expect(error.message).to.equals("Aborted.");
        });
      });

      it("should not warn or commit if only untracked files are present", function() {
        var cmd = createCommand();

        repo.respondTo('tags', makeResponder([]));
        repo.respondTo('status', makeResponder('?? not-in-repo.txt'));
        repo.respondTo('status', makeResponder('?? not-in-repo.txt'));
        repo.respondTo('createTag', makeResponder(null));

        return cmd.validateAndRun([ '--local', '--yes' ]).then(function() {
          expect(ui.output).to.not.contain("Your working tree contains modifications that will be added to the release commit, proceed?");
        });
      });
    });

    describe("when working copy has no modifications", function() {
      beforeEach(function() {
        repo.respondTo('currentTag', makeResponder(null));
      });

      describe("when repo has no existing tags", function() {
        var defaultTag = 'v0.1.0';

        beforeEach(function() {
          repo.respondTo('tags', makeResponder([]));
          repo.respondTo('status', makeResponder(''));
          repo.respondTo('status', makeResponder(''));
        });

        it("should create a default semver tag", function() {
          var createdTagName;
          var cmd = createCommand();

          ui.waitForPrompt().then(function() {
            ui.inputStream.write('y' + EOL);
          });

          repo.respondTo('createTag', function(tagName, message) {
            createdTagName = tagName;

            return null;
          });

          return cmd.validateAndRun([ '--local' ]).then(function() {
            expect(createdTagName).to.equal(defaultTag);
            expect(ui.output).to.contain("Successfully created git tag '" + defaultTag + "' locally.");
          });
        });
      });

      describe("when repo has existing tags", function() {
        var nextTag = 'v1.0.2';
        var tags = [
          {
            name: 'v1.0.0',
            sha: '7d1743e11a45f3863af1942b310412cbcd753271',
            date: new Date(Date.UTC(2013, 1, 15, 14, 35, 10))
          },
          {
            name: 'v1.0.1',
            sha: '0ace3a0a3a2c36acd44fc3acb2b0d57fde2faf6c',
            date: new Date(Date.UTC(2013, 2, 3, 4, 2, 33))
          }
        ];

        beforeEach(function() {
          repo.respondTo('tags', makeResponder(tags));
          repo.respondTo('status', makeResponder(''));
        });

        describe("when working copy is not changed", function() {
          beforeEach(function() {
            repo.respondTo('status', makeResponder(''));
          });

          it("should confirm tag creation and allow aborting", function() {
            var cmd = createCommand();

            ui.waitForPrompt().then(function() {
              ui.inputStream.write('n' + EOL);
            });

            return cmd.validateAndRun([ '--local' ]).then(function() {
              expect(ui.output).to.contain("About to create tag '" + nextTag + "', proceed?");
            }).catch(function(error) {
              expect(error.message).to.equals("Aborted.");
            });
          });

          it("should skip confirmation prompts when --yes option is set", function() {
            var cmd = createCommand();

            repo.respondTo('createTag', makeResponder(null));

            return cmd.validateAndRun([ '--local', '--yes' ]).then(function() {
              expect(ui.output).to.contain("Successfully created git tag '" + nextTag + "' locally.");
            });
          });

          it("should print the latest tag if returned by versioning strategy", function() {
            var cmd = createCommand();

            repo.respondTo('createTag', makeResponder(null));

            return cmd.validateAndRun([ '--local', '--yes' ]).then(function() {
              expect(ui.output).to.contain("Latest version: " + tags[tags.length - 1].name);
            });
          });

          it("should replace the 'version' property in package.json and bower.json", function() {
            copyFixture('project-with-no-config');
            var cmd = createCommand();

            repo.respondTo('createTag', makeResponder(null));

            return cmd.validateAndRun([ '--local', '--yes' ]).then(function() {
              var pkg = JSON.parse(fs.readFileSync('./package.json'));
              var bower = JSON.parse(fs.readFileSync('./bower.json'));

              var rawVersion = nextTag.replace(/^v/, '');

              expect(pkg.version).to.equal(rawVersion);
              expect(bower.version).to.equal(rawVersion);
            });
          });

          it("should replace the 'version' property in the files specified by the 'manifest' option", function() {
            copyFixture('project-with-different-manifests');
            var cmd = createCommand();

            repo.respondTo('createTag', makeResponder(null));

            return cmd.validateAndRun([ '--local', '--yes', '--manifest=foo.json', '--manifest=bar.json' ]).then(function() {
              var foo = JSON.parse(fs.readFileSync('./foo.json'));
              var bar = JSON.parse(fs.readFileSync('./bar.json'));

              var rawVersion = nextTag.replace(/^v/, '');

              expect(foo.version).to.equal(rawVersion);
              expect(bar.version).to.equal(rawVersion);
            });
          });

          it("should not add a 'version' property in package.json and bower.json if it doesn't exsist", function() {
            copyFixture('project-with-no-versions');
            var cmd = createCommand();

            repo.respondTo('createTag', makeResponder(null));

            return cmd.validateAndRun([ '--local', '--yes' ]).then(function() {
              var pkg = JSON.parse(fs.readFileSync('./package.json'));
              var bower = JSON.parse(fs.readFileSync('./bower.json'));

              expect(pkg.version).to.be.undefined;
              expect(bower.version).to.be.undefined;
            });
          });

          it("should ensure package.json is normalized with a trailing newline", function() {
            copyFixture('project-with-config');
            var cmd = createCommand();

            repo.respondTo('createTag', makeResponder(null));

            return cmd.validateAndRun([ '--local', '--yes' ]).then(function() {
              var pkgSource = fs.readFileSync('./package.json', { encoding: 'utf8' });

              expect(pkgSource[pkgSource.length - 2]).to.equal('}');
              expect(pkgSource[pkgSource.length - 1]).to.equal('\n');
            });
          });

          it("should use the tag name specified by the --tag option", function() {
            var createdTagName, createdTagMessage;
            var cmd = createCommand();

            ui.waitForPrompt().then(function() {
              ui.inputStream.write('y' + EOL);
            });

            repo.respondTo('createTag', function(tagName, message) {
              createdTagName = tagName;
              createdTagMessage = message;

              return null;
            });

            return cmd.validateAndRun([ '--tag', 'foo', '--local' ]).then(function() {
              expect(createdTagName).to.equal('foo');
              expect(createdTagMessage).to.be.falsey;
              expect(ui.output).to.contain("Successfully created git tag '" + createdTagName + "' locally.");
            });
          });

          it("should use the message specified by the --annotation option", function() {
            var createdTagName, createdTagMessage;
            var cmd = createCommand();

            ui.waitForPrompt().then(function() {
              ui.inputStream.write('y' + EOL);
            });

            repo.respondTo('createTag', function(tagName, message) {
              createdTagName = tagName;
              createdTagMessage = message;

              return null;
            });

            return cmd.validateAndRun([ '--annotation', 'Tag %@', '--local' ]).then(function() {
              expect(createdTagName).to.equal(nextTag);
              expect(createdTagMessage ).to.equal('Tag ' + nextTag);
              expect(ui.output).to.contain("Successfully created git tag '" + createdTagName + "' locally.");
            });
          });

          it("should use the strategy specified by the --strategy option, passing tags and options", function() {
            var tagNames = tags.map(function(tag) { return tag.name; });
            var createdTagName, strategyTags, strategyOptions;

            var cmd = createCommand({
              strategies: function() {
                return {
                  foo: {
                    availableOptions: [
                      {
                        name: 'bar',
                        type: Boolean,
                      },
                      {
                        name: 'baz',
                        type: String,
                      },
                    ],
                    getNextTag: function(project, tags, options) {
                      strategyTags = tags;
                      strategyOptions = options;

                      return 'foo';
                    }
                  }
                };
              }
            });

            ui.waitForPrompt().then(function() {
              ui.inputStream.write('y' + EOL);
            });

            repo.respondTo('createTag', function(tagName) {
              createdTagName = tagName;

              return null;
            });

            return cmd.validateAndRun([ '--strategy', 'foo', '--local', '--bar', '--baz', 'quux' ]).then(function() {
              expect(createdTagName).to.equal('foo');
              expect(strategyTags).to.deep.equal(tagNames);
              expect(strategyOptions.bar).to.be.true;
              expect(strategyOptions.baz).to.equal('quux');
              expect(ui.output).to.contain("Successfully created git tag '" + createdTagName + "' locally.");
            });
          });

          it("should push tags to the remote specified by the --remote option if the --local option is false", function() {
            var pushRemote, tagName;
            var cmd = createCommand();

            ui.waitForPrompt().then(function() {
              ui.inputStream.write('y' + EOL);
            });

            repo.respondTo('createTag', makeResponder(null));

            repo.respondTo('push', function(remote, tag) {
              pushRemote = remote;
              tagName = tag;

              return null;
            });

            return cmd.validateAndRun([ '--remote', 'foo' ]).then(function() {
              expect(pushRemote).to.equal('foo');
              expect(tagName).to.equal(nextTag);
              expect(ui.output).to.contain("About to create tag '" + nextTag + "' and push to remote '" + pushRemote + "', proceed?");
              expect(ui.output).to.contain("Successfully created git tag '" + nextTag + "' locally.");
              expect(ui.output).to.contain("Successfully pushed '" + nextTag + "' to remote '" + pushRemote + "'.");
            });
          });
        });

        describe("lifecycle hooks", function () {
          beforeEach(function() {
            repo.respondTo('currentBranch', makeResponder('master'));
          });

          it("should print a warning about non-function hooks", function() {
            copyFixture('project-with-bad-config');
            var cmd = createCommand();

            repo.respondTo('status', makeResponder(' M package.json'));
            repo.respondTo('createTag', makeResponder(null));
            repo.respondTo('commitAll', makeResponder(null));

            return cmd.validateAndRun([ '--local', '--yes' ]).then(function() {
              expect(ui.output).to.contain("Warning: `beforeCommit` is not a function");
            });
          });

          it("should execute hooks in the correct order", function () {
            copyFixture('project-with-hooks-config');
            var cmd = createCommand();
            var assertionCount = 0;

            expect(fileExists('init.txt'), 'init not called yet').to.be.false;

            repo.respondTo('status', function() {
              expect(fileExists('init.txt'), 'init called').to.be.true;
              assertionCount++;
              return ' M package.json';
            });
            repo.respondTo('commitAll', function() {
              expect(fileExists('before-commit.txt'), 'beforeCommit called').to.be.true;
              assertionCount++;
            });
            repo.respondTo('createTag', makeResponder(null));
            repo.respondTo('push', function() {
              expect(fileExists('after-push.txt'), 'afterPush not called yet').to.be.false;
              assertionCount++;
            });
            repo.respondTo('push', makeResponder(null));

            return cmd.validateAndRun([ '--yes' ]).then(function() {
              expect(fileExists('after-push.txt'), 'afterPush called').to.be.true;
              expect(assertionCount, 'all assertions ran').to.equal(3);
            });
          });

          it("should pass the correct values into hooks", function () {
            copyFixture('project-with-hooks-config');
            var cmd = createCommand();

            repo.respondTo('status', makeResponder(' M package.json'));
            repo.respondTo('commitAll', makeResponder(null));
            repo.respondTo('createTag', makeResponder(null));
            repo.respondTo('push', makeResponder(null));
            repo.respondTo('push', makeResponder(null));

            return cmd.validateAndRun([ '--yes' ]).then(function() {
              expect(fileContents('init.txt')).to.equal(nextTag);
              expect(fileContents('before-commit.txt')).to.equal(nextTag);
              expect(fileContents('after-push.txt')).to.equal(nextTag);
            });
          });

          it("should allow aborting directly from hooks", function () {
            copyFixture('project-with-aborted-hooks-config');
            var cmd = createCommand();

            return cmd.validateAndRun([ '--tag', 'immediate' ]).catch(function(error) {
              expect(error.message).to.equals('Error encountered in `init` hook: "nope"');
            });
          });

          it("should allow aborting from promise returned by hooks", function () {
            copyFixture('project-with-aborted-hooks-config');
            var cmd = createCommand();

            return cmd.validateAndRun([ '--tag', 'promise' ]).catch(function(error) {
              expect(error.message).to.equals('Error encountered in `init` hook: "nope"');
            });
          });
        });

        describe("configuration via config/release.js", function () {
          beforeEach(function() {
            repo.respondTo('status', makeResponder(''));
          });

          it("should print a warning about unknown options", function() {
            copyFixture('project-with-bad-config');
            var cmd = createCommand();

            repo.respondTo('createTag', makeResponder(null));

            return cmd.validateAndRun([ '--local', '--yes' ]).then(function() {
              expect(ui.output).to.contain("Warning: cannot specify option `minor`");
              expect(ui.output).to.contain("Warning: invalid option `foo`");
            });
          });

          it("should allow flexible option values", function() {
            copyFixture('project-with-bad-config');
            var cmd = createCommand();

            repo.respondTo('createTag', makeResponder(null));

            // This tests that the `manifest` option can be specified as a single string
            return cmd.validateAndRun([ '--local', '--yes' ]).then(function() {
              var foo = JSON.parse(fs.readFileSync('./foo.json'));

              var rawVersion = nextTag.replace(/^v/, '');
              expect(foo.version).to.equal(rawVersion);
            });
          });

          it("should use the strategy specified by the config file", function() {
            var createdTagName;

            copyFixture('project-with-config');
            var cmd = createCommand();

            repo.respondTo('createTag', function(tagName) {
              createdTagName = tagName;
              return null;
            });

            return cmd.validateAndRun([ '--local', '--yes' ]).then(function() {
              expect(createdTagName).to.match(/\d{4}\.\d{2}\.\d{2}/);
              expect(ui.output).to.contain("Successfully created git tag '" + createdTagName + "' locally.");
            });
          });

          it("should use the strategy specified on the command line over one in the config file", function() {
            var createdTagName;

            copyFixture('project-with-config');
            var cmd = createCommand();

            repo.respondTo('createTag', function(tagName) {
              createdTagName = tagName;
              return null;
            });

            return cmd.validateAndRun([ '--strategy', 'semver', '--local', '--yes' ]).then(function() {
              expect(createdTagName).to.equal(nextTag);
              expect(ui.output).to.contain("Successfully created git tag '" + createdTagName + "' locally.");
            });
          });

          it("should use the strategy defined in the config file", function() {
            var tagNames = tags.map(function(tag) { return tag.name; });
            var tagName = 'foo';

            copyFixture('project-with-strategy-config');
            var cmd = createCommand();

            repo.respondTo('createTag', makeResponder(null));

            return cmd.validateAndRun([ '--local', '--yes' ]).then(function() {
              expect(JSON.parse(fileContents('tags.json'))).to.deep.equal(tagNames);
              expect(ui.output).to.contain("Successfully created git tag '" + tagName + "' locally.");
            });
          });

          it("should use the strategy and options defined in the config file", function() {
            var tagName = 'foo';

            copyFixture('project-with-options-strategy-config');
            var cmd = createCommand();

            repo.respondTo('createTag', makeResponder(null));

            return cmd.validateAndRun([ '--local', '--yes', '--foo', 'bar' ]).then(function() {
              expect(JSON.parse(fileContents('options.json'))).to.have.property('foo', 'bar');
              expect(ui.output).to.contain("Successfully created git tag '" + tagName + "' locally.");
            });
          });

          it("should abort if the strategy defined in the config file does not return a valid value", function() {
            var tagNames = tags.map(function(tag) { return tag.name; });
            var tagName = 'foo';

            copyFixture('project-with-bad-strategy-config');
            var cmd = createCommand();

            repo.respondTo('createTag', makeResponder(null));

            return cmd.validateAndRun([ '--local', '--yes' ]).catch(function(error) {
              expect(error.message).to.equal("Tagging strategy must return a non-empty tag name");
            });
          });
        });

        describe("when working copy is changed", function() {
          beforeEach(function() {
            repo.respondTo('status', makeResponder('M package.json'));
          });

          describe("when repo is in detached HEAD state", function() {
            beforeEach(function() {
              repo.respondTo('currentBranch', makeResponder(null));
            });

            it("should abort with an informative message", function() {
              var cmd = createCommand();

              return cmd.validateAndRun([]).catch(function(error) {
                expect(error.message).to.equals("Must have a branch checked out to commit to");
              });
            });
          });

          describe("when a branch is currently checked out", function() {
            beforeEach(function() {
              repo.respondTo('currentBranch', makeResponder('master'));
            });

            it("should create a new commit with the correct message name", function() {
              var commitMessage;
              var cmd = createCommand();

              repo.respondTo('commitAll', function(message) {
                commitMessage = message;

                return null;
              });

              repo.respondTo('createTag', makeResponder(null));

              return cmd.validateAndRun([ '--message', 'Foo %@', '--local', '--yes' ]).then(function() {
                expect(commitMessage).to.equal('Foo ' + nextTag);
                expect(ui.output).to.contain("Successfully committed changes '" + commitMessage + "' locally.");
              });
            });

            it("should push the commit to the remote specified by the --remote option if the --local option is false", function() {
              var pushRemote, branchName;
              var cmd = createCommand();

              repo.respondTo('commitAll', makeResponder(null));
              repo.respondTo('createTag', makeResponder(null));
              repo.respondTo('push', function(remote, branch) {
                pushRemote = remote;
                branchName = branch;

                return null;
              });
              repo.respondTo('push', makeResponder(null));

              return cmd.validateAndRun([ '--yes' ]).then(function() {
                expect(ui.output).to.contain("Successfully pushed '" + branchName + "' to remote '" + pushRemote + "'.");
              });
            });
          });
        });
      });
    });
  });
});
