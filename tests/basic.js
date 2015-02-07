var assert        = require("assert");
var should        = require("should");
var moment        = require('moment');
var Promise       = require('bluebird');
var Cruisecontrol = new require("../index.js");
var Common        = require('./Common').Common;

describe('basic cruisecontrol instance', function () {
 it('should return an object', function (done) {
    var cruisecontrol = new Cruisecontrol(Common.getConfig());
   (typeof cruisecontrol).should.equal('object');
   done();
 });
 it('should not have an overloaded value', function (done) {
    var cruisecontrol = new Cruisecontrol(Common.getConfig());
    (cruisecontrol.getOverloaded() === null).should.equal(true);
    done();
 });
 it('should have api-defined functions', function (done) {
    var cruisecontrol = new Cruisecontrol(Common.getConfig());
	(typeof cruisecontrol.start).should.equal('function');
    (typeof cruisecontrol.setOverloaded).should.equal('function');
    (typeof cruisecontrol.getOverloaded).should.equal('function');
    (typeof cruisecontrol.getNumRuns).should.equal('function');
    (typeof cruisecontrol.next).should.equal('function');
    (typeof cruisecontrol.set).should.equal('function');

	done();
 });
 it('should process some data', function (done) {
    var cruisecontrol = new Cruisecontrol(Common.getConfig());
    cruisecontrol.set('finish',function() {
        cruisecontrol.getNumRuns().should.equal(10);
        done();
    });
    
    cruisecontrol.start();
 });
 it('should backoff when overloaded', function (done) {
    var cruisecontrol = new Cruisecontrol(Common.getConfig());
    cruisecontrol.setOverloaded(-1);

    cruisecontrol.getOverloaded().should.equal(-1);

    var startTime = moment();
    cruisecontrol.start();

    setTimeout(function() {
        cruisecontrol.getNumRuns().should.equal(0);
        (cruisecontrol.getOverloaded() === null).should.equal(true);
        done();
    }, 500);
 });
});