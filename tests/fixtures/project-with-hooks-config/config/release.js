/* jshint node:true */
var RSVP = require('rsvp');
var fs = require('fs');
var path = require('path');

module.exports = {
  init: function(project, versions) {
    return writeFile(project.root, 'init.txt', versions.next);
  },
  beforeCommit: function(project, versions) {
    return writeFile(project.root, 'before-commit.txt', versions.next);
  },
  afterPush: function(project, versions) {
    return writeFile(project.root, 'after-push.txt', versions.next);
  }
};

function writeFile(rootPath, filePath, contents) {
  return new RSVP.Promise(function(resolve, reject) {
    fs.writeFile(
      path.join(rootPath, filePath),
      contents,
      resolve);
  });
}
