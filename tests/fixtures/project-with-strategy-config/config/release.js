/* jshint node:true */
var RSVP = require('rsvp');
var fs = require('fs');
var path = require('path');

module.exports = {
  strategy: function(project, tags) {
    return writeFile(project.root, 'tags.json', JSON.stringify(tags)).then(function() {
      return {
        next: 'foo'
      };
    });
  }
};

function writeFile(rootPath, filePath, contents) {
  return new RSVP.Promise(function(resolve) {
    fs.writeFile(path.join(rootPath, filePath), contents, resolve);
  });
}
