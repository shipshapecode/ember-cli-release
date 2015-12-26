/* jshint node:true */
var RSVP = require('rsvp');
var fs = require('fs');
var path = require('path');

module.exports = {
  strategy: {
    availableOptions: [
      {
        name: 'foo',
        type: String,
      },
    ],

    getNextTag: function(project, tags, options) {
      writeFile(project.root, 'options.json', JSON.stringify(options));

      return 'foo';
    }
  }
};

function writeFile(rootPath, filePath, contents) {
  fs.writeFileSync(path.join(rootPath, filePath), contents);
}
