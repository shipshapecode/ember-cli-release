/* jshint node:true */
var RSVP = require('rsvp');
var fs = require('fs');
var path = require('path');

module.exports = {
  beforeCommit: function(project, versions){
    return new RSVP.Promise(function(resolve, reject){
      fs.writeFile(
        path.join(project.root, 'project-with-hooks-config-test.txt'),
        versions.next,
        resolve)
    });
  }
}
