var assert        = require("assert");
var should        = require("should");
var moment        = require('moment');
var Promise       = require('bluebird');
var Cruisecontrol = new require("../index.js");
var Common        = require('./Common').Common;

var passthru = Promise.method(function(x) { return x; });

var numRuns  = 0;

var gather = function() {
    if(numRuns < 10) { // Return 10 sets of results
        numRuns++;
        return [1,1,1,1,1,1,1,1,1,1];
    } else {
        return [];
    }
};

describe('threadded cruisecontrol instance', function () {
 it('should process some data', function (done) {
    var cfg      = Common.getConfig();
    cfg.gather   = gather;
    cfg.threads  = 2;
    // delete cfg.pipeline;
    delete cfg.summary;
    cfg.finish   = function(results) {
        cruisecontrol.getNumRuns().should.equal(10);
        numRuns.should.equal(10);
        results.length.should.equal(100);
        done();
    };
    var cruisecontrol = new Cruisecontrol(cfg);
    cruisecontrol.getNumRuns().should.equal(0);
    cruisecontrol.start();
 });
});