# ember-cli-release

Ember CLI addon that defines a `release` command for bumping the version of your app or addon.

## Installation

```sh
$ ember addon:install ember-cli-release
```

## Usage

This addon revolves around git tags, and so relies heavily on shelling out to run git commands (unlike the wonderful [`git-repo-info`](https://github.com/rwjblue/git-repo-info)).

When invoked with no options:

```sh
$ ember release
```

It will:

  1. Assume that the project uses the [SemVer](http://semver.org/) versioning scheme
  2. Find the latest tag that is SemVer compliant and increment its PATCH version
  3. Create a git tag with the new version and push it to `origin`

### Options

Also available through `ember help`:

- `--local` (default: `false`) - Whether to only create the git tag locally or not
- `--remote` (default: `origin`) - The git remote to push new tags to, ignored if `--local` is true
- `--yes` (default: `false`) - Whether to skip confirmation prompts or not (answer 'yes' to all questions)
- `--tag` (default: `null`) - Optional name of the tag to create, overrides versioning strategies
- `--message` (default: `Release %@`) - Message to add to the annotated git tag, where `%@` is replaced with tag name
- `--strategy` (default: `semver`) - The versioning strategy to use, either `semver` or `date`
- `--major` (default: `false`) - Increment the MAJOR SemVer version, takes precedence over `--minor`
- `--minor` (default: `false`) - Increment the MINOR SemVer version, if both `--major` and `--minor` are false, PATCH is incremented
- `--format` (default: `YYYY.MM.DD`) - The format string used when creating a tag based on the current date, uses [`moment().format()`](http://momentjs.com/docs/#/displaying/format/)
- `--timezone` (default: `UTC`) - The timezone to consider the current date in

So for example, to create a new tag based on the date in east cost time with a custom format and message:

```sh
$ ember release --strategy=date --format="YYYY-MM-DD" --timezone="America/New_York"
```

Or to create a specific tag (no versioning strategy) with a custom message, locally only:

```sh
$ ember release --local --tag="what_am_i_doing" --message="First version wooooo!"
```

## Roadmap

1. ☑ Abort if HEAD is already at a tag
2. ◻ If working tree is dirty, prompt user that their changes will be included in release commit
3. ☑ Calculate new version
  1. Use `--tag` option if present
  2. Generate new version using `--strategy` option (default: 'semver')
    - SemVer
      1. Look for latest tag using `node-semver` ordering
      2. Increment based on `--major`, `--minor`, or `--patch` (default: `--patch`)
    - Date
      1. Create tag name based on current date and `--format` option (default: `YYYY.MM.DD`)
      2. Look for existing tag of same name, append `.X` where X is an incrementing integer
  3. Print new version name
4. ◻ Search/replace most recent version with new version
  1. Search all project files for most recent version, ignore if path matches any rule in `.gitignore`
  2. Display surrounding diff and prompt user for replacement of each instance
5. ◻ Commit changes
  - Skip if working tree is clean
  - Use `--message` option with available replacement of new version (default: `Released %@`)
6. ☑ Create tag
  1. Tag the latest commit with new version using the `--tag-message` option (default: `Release %@`)
  2. Stop if `--local` option is true
7. ☑ Push to remote
  - Push commits and tags to remote specified by `--remote` option (default: `origin`)
8. ◻ NPM Publish
  - Stop if `--publish` option is false (default: `false`)
  - Publish package to NPM using current name/password

## Contributing

Pull requests welcome, but they must be fully tested (and pass all existing tests) to be considered. Discussion issues also welcome.

## Running Tests

```sh
$ npm test
```
