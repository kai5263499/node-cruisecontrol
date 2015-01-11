var assert        = require("assert");
var should        = require("should");
var Cruisecontrol = new require("../index.js");
// Keep track of the number of times the gather function was run so we can terminate the test
var run = 0;

// Function that returns some data to process
var gather = function() {
    if(run < 10) { // Return 10 sets of results
        run++;
        return [1,1,1,1,1,1,1,1,1,1];
    } else {
        return [];
    }
};

// Function that processes the data
var addOne = function(item) {
    return item+1;
};

// Function that processes the result of the pipeline
var avg = function(items) {
    var total = 0;
    var len   = items.length;
    for(var i=len-1;i>=0;i--) {
        total += items[i];
    }
    var avg = total/len;
};

var config = {
    strategy: {
        type:'fib',     // [Optional] The backoff strategy to use. 'fib' for fibbonacci and 'exp' for expotential
        options: null   // [Optional] The backoff configuration to use
    },
    loop: false,        // Whether to continue polling, with backoff, for new records
    gather: gather,     // Singular method for gathering a batch of items to process
    pipeline: [addOne], // Array of functions to perform row-level work
    summary: [avg],     // [Optional] Array of functions to apply in-order to the aggregated output of the pipeline
    finish: null,       // [Optional] Function to call when gather returns an empty set
    threshold: {
        mem: 0.7,       // Percentage of memory which must be free
        cpu: 2          // Load average in the last 5 minutes that the CPU must be under
    }
};

describe('cruisecontrol instance', function () {
 it('should return an object', function (done) {
    var cruisecontrol = new Cruisecontrol(config);
   (typeof cruisecontrol).should.equal('object');
   done();
 });
 it('should not have an overloaded value', function (done) {
    var cruisecontrol = new Cruisecontrol(config);
    (cruisecontrol.getOverloaded() === null).should.equal(true);
    done();
 });
 it('should have api-defined functions', function (done) {
    var cruisecontrol = new Cruisecontrol(config);
	(typeof cruisecontrol.start).should.equal('function');
    (typeof cruisecontrol.setOverloaded).should.equal('function');
    (typeof cruisecontrol.getOverloaded).should.equal('function');
    (typeof cruisecontrol.getNumRuns).should.equal('function');
    (typeof cruisecontrol.next).should.equal('function');
    (typeof cruisecontrol.set).should.equal('function');

	done();
 });
 it('should process some data', function (done) {
    var cruisecontrol = new Cruisecontrol(config);
    cruisecontrol.set('finish',function() {
        cruisecontrol.getNumRuns().should.equal(10);
        done();
    });


    cruisecontrol.start();
 });
 it('should backoff when overloaded', function (done) {
    var cruisecontrol = new Cruisecontrol(config);
    cruisecontrol.setOverloaded(-1);

    cruisecontrol.getOverloaded().should.equal(-1);

    cruisecontrol.start();

    cruisecontrol.set('finish',function() {
        cruisecontrol.getNumRuns().should.equal(0);
        (cruisecontrol.getOverloaded() === null).should.equal(true);
        done();
    });
 });
});