# ember-cli-release

[![Build Status](https://travis-ci.org/lytics/ember-cli-release.svg?branch=master)](https://travis-ci.org/lytics/ember-cli-release)
[![NPM Version](https://badge.fury.io/js/ember-cli-release.svg)](http://badge.fury.io/js/ember-cli-release)
[![Ember Observer Score](http://emberobserver.com/badges/ember-cli-release.svg)](http://emberobserver.com/addons/ember-cli-release)

Ember CLI addon that defines a `release` command for bumping the version of your app or addon.

## Installation

```sh
$ ember install ember-cli-release
```

This will also generate the config file `config/release.js` which can be used to provide default options ([see below](#options)).

## Usage

This addon revolves around git tags, and so relies heavily on shelling out to run git commands (unlike the wonderful [`git-repo-info`](https://github.com/rwjblue/git-repo-info)).

When invoked with no options:

```sh
$ ember release
```

It will:

  1. Assume that the project uses the [SemVer](http://semver.org/) versioning scheme
  2. Find the latest tag that is SemVer compliant and increment its PATCH version
  3. Replace the `version` property of `package.json` and `bower.json` with the new version
  4. Commit all changes to the working tree
  5. Create a lightweight git tag with the new version
  6. Push the branch and the new tag to `origin`

See the [examples section](#examples) for more ways to use the command.

## Options

Options can be specified on the command line or in `config/release.js` unless marked with an asterisk (`*`). Options specified on the command line **always take precedence** over options in the config file. Run `ember help` to see CLI aliases.

- `local`

  Default: `false`

  Whether to only create the git tag locally or not.

- `remote`

  Default: `'origin'`

  The git remote to push new tags to, ignored if `local` is true.

- `tag`\*

  Default: `null`

  Optional name of the tag to create, overrides versioning strategies.

- `annotation`

  Default: `null`

  Message to add when creating a tag, [indicates that the tag should be annotated](http://git-scm.com/book/tr/v2/Git-Basics-Tagging#Annotated-Tags), where `%@` is replaced with tag name.

- `message`

  Default: `'Released %@'`

  Message to use when committing changes to the working tree (including changes to `package.json` and `bower.json`), where `%@` is replaced with tag name.

- `manifest`

  Default: `[ 'package.json', 'bower.json' ]`

  A set of JSON manifest files to replace the top-level `version` key in with the new tag name.

- `yes`\*

  Default: `false`

  Whether to skip confirmation prompts or not (answer 'yes' to all questions).

- `strategy`

  Default: `'semver'`

  The versioning strategy to use, either `semver` or `date`.

- `major`\*

  Default: `false`

  Increment the MAJOR SemVer version, takes precedence over `minor`. Only used when the `strategy` option is `'semver'`.

- `minor`\*

  Default: `false`

  Increment the MINOR SemVer version, if both `major` and `minor` are false, PATCH is incremented. Only used when the `strategy` option is `'semver'`.

- `format`

  Default: `'YYYY.MM.DD'`

  The format string used when creating a tag based on the current date using [`moment().format()`](http://momentjs.com/docs/#/displaying/format/). Only used when the `strategy` option is `'date'`.

- `timezone`

  Default: `'UTC'`

  The timezone to consider the current date in. Only used when the `strategy` option is `'date'`.

## Hooks

A set of lifecycle hooks exists as a means to inject additional behavior into the release process. Lifecycle hooks can be specified in `config/release.js`. All hooks can return a thenable that will be resolved before continuing the release process. Throwing from a hook or rejecting a promise returned by a hook will halt the release process and print the error.

Hooks are passed two arguments:

  - `project` - a reference to the current ember-cli project
  - `versions` - an object containing tag information, which will always have a `next` property and depending on the strategy you are using, may also have a `latest` property. The version will be the exact value that was used for the tag, by default this includes a `v` prefix.

There are three lifecycle hooks available:

- `init`

  Called after the new version has been computed but before any changes are made to the filesystem or repository. Use this hook if you need to verify that the local environment is setup for releasing, and abort if not.

  ###### Example Usage

  Aborting:

  ```js
  // config/release.js
  var RSVP = require('rsvp');
  var npmWhoami = require('npm-whoami');

  // Create promise friendly version of the node-style async method
  var whoami = RSVP.denodeify(npmWhoami);

  module.exports = {
    init: function() {
      if (!process.env.SUPER_SECRET_KEY) {
        throw 'Super secret key missing!';
      }

      return whoami().then(function(username) {
        if (!username) {
          throw 'No NPM user authorized, cannot publish!';
        }
      });
    }
  };
  ```

- `beforeCommit`

  Called after the new version has been replaced in manifest files but before the changes have been committed. Use this hook if you need to update the version number in additional files, or build the project to update dist files. Note that this hook runs regardless of whether a commit will be made.

  ###### Example Usage

  Version replacement:

  ```js
  // config/release.js
  var path = require('path');
  var xmlpoke = require('xmlpoke');

  module.exports = {
    beforeCommit: function(project, versions) {
      xmlpoke(path.join(project.root, 'cordova/config.xml'), function(xml) {
        xml.errorOnNoMatches();
        xml.addNamespace('w', 'http://www.w3.org/ns/widgets');
        xml.set('w:widget/@version', versions.next);
      });
    }
  };
  ```

  Building:

  ```js
  // config/release.js
  var BuildTask = require('ember-cli/lib/tasks/build');

  module.exports = {
    // Build the project in the production environment, outputting to dist/
    beforeCommit: function(project) {
      var task = new BuildTask({
        project: project,
        ui: project.ui,
        analytics: project.cli.analytics
      });

      return task.run({
        environment: 'production',
        outputPath: 'dist/'
      });
    }
  };
  ```

- `afterPush`

  Called after successfully pushing all changes to the specified remote, but before exiting. Use this hook for post-release tasks like publishing, cleanup, or sending notifications from your CI server.

  ###### Example Usage

  Publishing:

  ```js
  // config/release.js
  var RSVP = require('rsvp');
  var publisher = require('publish');

  // Create promise friendly versions of the methods we want to use
  var start = RSVP.denodeify(publisher.start);
  var publish = RSVP.denodeify(publisher.publish);

  module.exports = {
    // Publish the new release to NPM after a successful push
    // If run from travis, this will look for the NPM_USERNAME, NPM_PASSWORD and
    // NPM_EMAIL environment variables to publish the package as
    afterPush: function() {
      return start().then(function() {
        return publish({});
      });
    }
  };
  ```

  Notification:

  ```js
  // config/release.js
  var Slack = require('node-slack');

  // Look for slack configuration in the CI environment
  var isCI = process.env.CI;
  var hookURL = process.env.SLACK_HOOK_URL;

  module.exports = {
    // Notify the #dev channel when a new release is created
    afterPush: function(project, versions) {
      if (isCI && hookURL) {
        var slack = new Slack(hookURL);

        return slack.send({
          text: 'ZOMG, ' + project.name() + ' ' + versions.next + ' RELEASED!!1!',
          channel: '#dev',
          username: 'Mr. CI'
        });
      }
    }
  };
  ```

## Workflow

These are the steps that take place when running the `release` command (unchecked steps have not yet been implemented):

1. ☑ Abort if HEAD is already at a tag
2. ☑ Calculate new version
  1. Use `tag` option if present
  2. Generate new version using `strategy` option (default: 'semver')
    - SemVer
      1. Look for latest tag using `node-semver` ordering
      2. Increment based on `major`, `minor`, or `patch` (default: `patch`)
    - Date
      1. Create tag name based on current date and `format` option (default: `YYYY.MM.DD`)
      2. Look for existing tag of same name, append `.X` where X is an incrementing integer
  3. Print new version name
3. ☑ Invoke the `init` hook
4. ☑ If working tree is dirty, prompt user that their changes will be included in release commit
5. ☑ Replace `version` property of files specified by the `manifest` option (default: `package.json`/`bower.json`)
6. ◻ Run `ember build` if `build` option is `true` (default: `false`)
7. ◻ Generate changelog entry and append to `CHANGELOG.md`
8. ☑ Invoke the `beforeCommit` hook
9. ☑ Commit changes
  1. Skip if working tree is unmodified
  2. Stage all changes and commit with `message` option as the commit message
10. ☑ Create tag
  1. Prompt to continue with new tag name
  2. Tag the latest commit with new version using the `annotation` option if specified
11. ☑ Push to remote
  1. Skip if `local` option is `true` (default: `false`)
  2. Push current branch and tags to remote specified by `remote` option
12. ☑ Invoke the `afterPush` hook
13. ◻ Publish package to NPM using current credentials if `publish` option is `true` (default: `false`)

## Examples

To create a new tag based on the date in east cost time with a custom format:

```sh
$ ember release --strategy=date --format="YYYY-MM-DD" --timezone="America/New_York"
```

Or to create a specific tag (no versioning strategy) with annotation, locally only:

```sh
$ ember release --local --tag="what_am_i_doing" --annotation="First version wooooo!"
```

## Contributing

Pull requests welcome, but they must be fully tested (and pass all existing tests) to be considered. Discussion issues also welcome.

## Running Tests

```sh
$ npm test
```
