# ember-cli-release

[![Build Status](https://travis-ci.org/lytics/ember-cli-release.svg?branch=master)](https://travis-ci.org/lytics/ember-cli-release)
[![npm version](https://badge.fury.io/js/ember-cli-release.svg)](http://badge.fury.io/js/ember-cli-release)

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

Options can be specified on the command line or in `config/release.js` unless marked with an asterisk (`*`). Options specified on the command line **always take presedence** over options in the config file. Run `ember help` to see CLI aliases.

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

## Workflow

These are the steps that take place when running the `release` command (unchecked steps have not yet been implemented):

1. ☑ Abort if HEAD is already at a tag
2. ☑ If working tree is dirty, prompt user that their changes will be included in release commit
3. ☑ Calculate new version
  1. Use `tag` option if present
  2. Generate new version using `strategy` option (default: 'semver')
    - SemVer
      1. Look for latest tag using `node-semver` ordering
      2. Increment based on `major`, `minor`, or `patch` (default: `patch`)
    - Date
      1. Create tag name based on current date and `format` option (default: `YYYY.MM.DD`)
      2. Look for existing tag of same name, append `.X` where X is an incrementing integer
  3. Print new version name
4. ☑ Replace `version` property of `package.json`/`bower.json` files with new version
5. ◻ Search/replace whitelisted files with new version
6. ◻ Invoke build config function if available or run `ember build` if `build` option is `true`
7. ◻ Invoke changelog config function if available
8. ☑ Commit changes
  1. Skip if working tree is unmodified
  2. Stage all changes and commit with `message` option as the commit message
9. ☑ Create tag
  1. Prompt to continue with new tag name
  2. Tag the latest commit with new version using the `annotation` option if specified
10. ☑ Push to remote
  1. Skip if `local` option is `true`
  2. Push current branch and tags to remote specified by `remote` option
11. ◻ NPM Publish
  1. Skip if `publish` option is `false`
  2. Publish package to NPM using current credentials

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
