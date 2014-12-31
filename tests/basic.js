var assert = require("assert");
var should = require("should");

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
    gather: gather,     // Singular method for gathering a batch of items to process
    pipeline: [addOne], // Array of functions to perform row-level work
    summary: [avg],     // [Optional] Array of functions to apply in-order to the aggregated output of the pipeline
    threshold: {
        mem: 0.7,       // Percentage of memory which must be free
        cpu: 2          // Load average in the last 5 minutes that the CPU must be under
    }
};

var cruisecontrol = new require("../index.js").cruisecontrol(config);

describe('cruisecontrol instance', function () {
 it('should return an object', function (done) {
   (typeof cruisecontrol).should.equal('object');
   done();
 });
 it('should not have an overloaded value', function (done) {
    (cruisecontrol.getOverloaded() === null).should.be.true;
    done();
 });
 it('should have api-defined functions', function (done) {
	(typeof cruisecontrol.start).should.equal('function');
    (typeof cruisecontrol.pause).should.equal('function');
    (typeof cruisecontrol.getOverloaded).should.equal('function');
    (typeof cruisecontrol.getNumRuns).should.equal('function');
    (typeof cruisecontrol.next).should.equal('function');
    (typeof cruisecontrol.stop).should.equal('function');
	done();
 });
 it('should process some data', function (done) {
    cruisecontrol.start();
    cruisecontrol.getNumRuns().should.equal(10);
    done();
 });
 it('should backoff when overloaded', function(done) {
    cruisecontrol.pause();
    cruisecontrol.start();

    // Nothing should run while the system is overloaded
    cruisecontrol.getNumRuns().should.equal(10);

    cruisecontrol.getOverloaded().should.not.equal(null);
    done();
 });
});