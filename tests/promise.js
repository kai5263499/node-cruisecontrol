

var assert        = require("assert");
var should        = require("should");
var moment        = require('moment');
var Promise       = require('bluebird');
var Cruisecontrol = new require("../index.js");
var Common        = require('./Common').Common;

describe('promisified cruisecontrol instance', function () {
  it('should handle promises properly',function(done) {
    var config = Common.getConfig();
    config.maxRuns = 10;

    config.gather   = function() {
                        return new Promise(function(resolve,reject) {
                                    resolve([1,1,1,1,1,1,1,1,1,1]);
                                });
                      };
    config.pipeline = [
        function(val) {
            val.should.equal(1);
            return new Promise(function(resolve,reject) {
                resolve(val+1);
            });
        },
        function(val) {
            val.should.equal(2);
            return new Promise(function(resolve,reject) {
                resolve(val+1);
            });
        }
      ];

    config.summary = [
        function(items) {
            return new Promise(function(resolve,reject) {
                items.should.have.lengthOf(10);
                resolve(items);
            });
        }
    ];

    var cruisecontrol = new Cruisecontrol(config);
    cruisecontrol.set('finish',function() {
        cruisecontrol.getNumRuns().should.equal(10);

        done();
    });

    cruisecontrol.start();
  });
  it('should handle singlular promises properly',function(done) {
    var config = Common.getConfig();
    config.maxRuns = 10;

    config.gather   = function() {
                        return new Promise(function(resolve,reject) {
                                    resolve([1,1,1,1,1,1,1,1,1,1]);
                                    
                                });
                      };
    config.pipeline = function(val) {
            return new Promise(function(resolve,reject) {
                resolve(val+1);
            });
        };

    config.summary = function(items) {
            items.should.have.lengthOf(10);
            return new Promise(function(resolve,reject) {
                resolve(items);
            });
        };

    var cruisecontrol = new Cruisecontrol(config);
    cruisecontrol.set('finish',function() {
        cruisecontrol.getNumRuns().should.equal(10);
        done();
    });

    cruisecontrol.start();
  });
});