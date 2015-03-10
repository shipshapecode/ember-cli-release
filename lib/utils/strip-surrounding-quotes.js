/* jshint node:true */

module.exports = function stripSurroundingQuotes(str) {
  var match = str.match(/^(?:"(.*)"|'(.*)'|(.*))$/);
  return match[1] || match[2] || match[3];
};