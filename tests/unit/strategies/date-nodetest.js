/* jshint node:true */

'use strict';

var expect = require('chai').expect;

var dateStrategy = require('../../../lib/strategies/date');

describe("date strategy", function() {
  // Fri, 15 Feb 2013 14:00:00 GMT
  var date = new Date(Date.UTC(2013, 1, 15, 14));
  var tagNames = [ '2012.12.5', '2012.12.28', '2013.1.5', '2013.1.25' ];

  beforeEach(function() {
    // Testing dates is the worst
    this.oldCurrentDate = dateStrategy.getCurrentDate;
    dateStrategy.getCurrentDate = function() {
      return date;
    };
  });

  afterEach(function() {
    dateStrategy.getCurrentDate = this.oldCurrentDate;
  });

  it("should generate a tag using the current date in UTC using the default format 'YYYY.MM.DD'", function() {
    var tag = dateStrategy.getNextTag(tagNames, {});

    expect(tag.next).to.equal('2013.02.15');
  });

  it("should generate a tag using the format specified by the 'format' option", function() {
    var tag = dateStrategy.getNextTag(tagNames, { format: 'x' });

    expect(tag.next).to.equal('1360936800000');
  });

  it("should use the date in the timezone specified by the 'timezone' option", function() {
    var tag = dateStrategy.getNextTag(tagNames, { timezone: 'Australia/Sydney' });

    expect(tag.next).to.equal('2013.02.16');
  });

  it("should add a patch number if the generated tag already exists", function() {
    var tags, tag;

    tags = tagNames.concat('2013.02.15');

    tag = dateStrategy.getNextTag(tags, {});
    expect(tag.next).to.equal('2013.02.15.1');

    tags = tags.concat('2013.02.15.1');

    tag = dateStrategy.getNextTag(tags, {});
    expect(tag.next).to.equal('2013.02.15.2');
  });
});
