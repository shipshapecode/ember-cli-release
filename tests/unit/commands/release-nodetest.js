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

var RSVP = require('rsvp');
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
  var TestReleaseCommand;

  beforeEach(function() {
    ui = new MockUI();
    analytics = new MockAnalytics();
    repo = new MockRepo();

    rimraf.sync('tmp');
    fs.mkdirSync('tmp');
    process.chdir('tmp');

    project = {
      root: path.resolve('.'),
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

    return new TestReleaseCommand(options);
  }

  before(function() {
    TestReleaseCommand = Command.extend(ReleaseCommand);
  });

  describe("when HEAD is at a tag", function() {
    it("should exit immediately if HEAD is at a tag", function() {
      var cmd = createCommand();

      repo.respondTo('currentTag', makeResponder('v1.3.0'));

      return cmd.validateAndRun().then(function() {
        expect(ui.output).to.contain('Skipped tagging, HEAD already at tag: v1.3.0');
      });
    });
  });

  describe("when HEAD is not at a tag", function() {
    beforeEach(function() {
      repo.respondTo('currentTag', makeResponder(null));
      repo.respondTo('tags', makeResponder([]));
    });

    describe("when repo has no existing tags", function() {
      var defaultTag = 'v0.1.0';

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
          expect(ui.output).to.contain("Succesfully created git tag '" + defaultTag + "'.");
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
        repo.respondTo('currentTag', makeResponder(null));
        repo.respondTo('tags', makeResponder(tags));
      });

      it("should confirm tag creation and allow aborting", function() {
        var cmd = createCommand();

        ui.waitForPrompt().then(function() {
          ui.inputStream.write('n' + EOL);
        });

        return cmd.validateAndRun([ '--local' ]).then(function() {
          expect(ui.output).to.contain("About to create tag '" + nextTag + "', proceed?");
          expect(ui.output).to.contain("Aborted.");
        });
      });

      it("should skip confirmation prompts when --yes option is set", function() {
        var cmd = createCommand();

        repo.respondTo('createTag', makeResponder(null));

        return cmd.validateAndRun([ '--local', '--yes' ]).then(function() {
          expect(ui.output).to.contain("Succesfully created git tag '" + nextTag + "'.");
        });
      });

      it("should print the latest tag if returned by versioning strategy", function() {
        var cmd = createCommand();

        ui.waitForPrompt().then(function() {
          ui.inputStream.write('n' + EOL);
        });

        return cmd.validateAndRun([ '--local' ]).then(function() {
          expect(ui.output).to.contain("Latest version: " + tags[tags.length - 1].name);
        });
      });

      it("should replace the 'version' property in package.json and bower.json", function() {
        var cmd = createCommand();

        copyFixture('project-with-no-config');

        repo.respondTo('createTag', makeResponder(null));

        return cmd.validateAndRun([ '--local', '--yes' ]).then(function() {
          var pkg = JSON.parse(fs.readFileSync('./package.json'));
          var bower = JSON.parse(fs.readFileSync('./bower.json'));

          expect(pkg.version).to.equal(nextTag);
          expect(bower.version).to.equal(nextTag);
        });
      });

      it("should not add a 'version' property in package.json and bower.json if it doesn't exsist", function() {
        var cmd = createCommand();

        copyFixture('project-with-no-versions');

        repo.respondTo('createTag', makeResponder(null));

        return cmd.validateAndRun([ '--local', '--yes' ]).then(function() {
          var pkg = JSON.parse(fs.readFileSync('./package.json'));
          var bower = JSON.parse(fs.readFileSync('./bower.json'));

          expect(pkg.version).to.be.undefined;
          expect(bower.version).to.be.undefined;
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
          expect(ui.output).to.contain("Succesfully created git tag '" + createdTagName + "'.");
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
          expect(ui.output).to.contain("Succesfully created git tag '" + createdTagName + "'.");
        });
      });

      it("should use the strategy specified by the --strategy option, passing tags and options", function() {
        var tagNames = tags.map(function(tag) { return tag.name; });
        var createdTagName, strategyTags, strategyOptions;
        var dateFormat = 'YYYY-MM-DD[T]HH:mm:ss.SSS[Z]';
        var timezone = 'America/Los_Angeles';

        var cmd = createCommand({
          strategies: {
            foo: function(tags, options) {
              strategyTags = tags;
              strategyOptions = options;

              return { next: 'foo' };
            }
          }
        });

        ui.waitForPrompt().then(function() {
          ui.inputStream.write('y' + EOL);
        });

        repo.respondTo('createTag', function(tagName) {
          createdTagName = tagName;

          return null;
        });

        return cmd.validateAndRun([ '--strategy', 'foo', '--local', '--major', '--format', dateFormat, '--timezone', timezone ]).then(function() {
          expect(createdTagName).to.equal('foo');
          expect(strategyTags).to.deep.equal(tagNames);
          expect(strategyOptions.major).to.be.true;
          expect(strategyOptions.format).to.equal(dateFormat);
          expect(strategyOptions.timezone).to.equal(timezone);
          expect(ui.output).to.contain("Succesfully created git tag '" + createdTagName + "'.");
        });
      });

      it("should push tags to the remote specified by the --remote option if the --local option is false", function() {
        var pushRemote;
        var cmd = createCommand();

        ui.waitForPrompt().then(function() {
          ui.inputStream.write('y' + EOL);
        });

        repo.respondTo('createTag', makeResponder(null));

        repo.respondTo('pushTags', function(remote) {
          pushRemote = remote;

          return null;
        });

        return cmd.validateAndRun([ '--remote', 'foo' ]).then(function() {
          expect(pushRemote).to.equal('foo');
          expect(ui.output).to.contain("About to create tag '" + nextTag + "' and push to remote '" + pushRemote + "', proceed?");
          expect(ui.output).to.contain("Succesfully created git tag '" + nextTag + "' and pushed to remote '" + pushRemote + "'.");
        });
      });
    });
  });
});