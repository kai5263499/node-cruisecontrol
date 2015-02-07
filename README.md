cruisecontrol
=========

This is a simple [negative feedback closed loop control system](http://en.wikipedia.org/wiki/Negative_feedback "Closed Loop Control System"). This takes as its input the system's CPU and memory usage load parameters and regulates the frequency of the (gather -> pipeline) operation as a closed loop. The purpose of this module is to ensure smooth(ish) system performance using a [backoff strategy](http://en.wikipedia.org/wiki/Exponential_backoff "Expotential Backoff") to allivieate system load pressure while processing a large amount of data.

## Installation

	npm install cruisecontrol --save

## Usage
    var Cruisecontrol = require('cruisecontrol');

    // Keep track of the number of times the gather function was run so we can terminate the test
    var run = 0;

    // Function that returns some data to process
    var gather = function() {
        if(run < 10) {
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
        threads: 1,         // [Optional] Number of threads to use to process the workload.
                            //            Setting this to 1 disables process forking.
        threshold: {
            mem: 0.7,       // Percentage of memory which must be free
            cpu: 2          // Load average in the last 5 minutes that the CPU must be under
        }
    };

	var cruisecontrol = new Cruisecontrol(config);
    cruisecontrol.start();

## Config options

<table>
    <tr>
        <td>Property</td>
        <td>Required</td>
        <td>Purpose</td>
    </tr>
    <tr>
        <td>strategy</td>
        <td>no</td>
        <td>The backoff strategy to use. Defaults to a fibbonacci backoff strategy</td>
    </tr>
    <tr>
        <td>loop</td>
        <td>no</td>
        <td>Instructs cruisecontrol to continue looping on the gather method even if it returns no rows. This is useful for continuously monitoring a queue which may sometimes be empty.</td>
    </tr>
    <tr>
        <td>gather</td>
        <td>yes</td>
        <td>A method which may or may not return a promise which then returns an array of items to pass along to the pipeline method(s).</td>
    </tr>
    <tr>
        <td>pipeline</td>
        <td>no</td>
        <td>Method or array of methods which may or may not return a promise to run. These methods are combined together and passed one item from the gather method which can then be mutated through the pipeline. If pipeline is omitted, a 'passthrough' method is supplied instead.</td>
    </tr>
    <tr>
        <td>summary</td>
        <td>no</td>
        <td>Method or array of methods which may or may not return a promise to run. The result is then passed all of the items emmited from the pipeline.</td>
    </tr>
    <tr>
        <td>finish</td>
        <td>no</td>
        <td>Method or array of methods which may or may not return a promise to run. These methods are combined together and passed all of the items that were passed along to the pipeline.</td>
    </tr>
    <tr>
        <td>threads</td>
        <td>no</td>
        <td>Number of worker threads to distribute the pipeline processing across.</td>
    </tr>
    <tr>
        <td>threshold</td>
        <td>yes</td>
        <td>Parameters of when to switch the cruisecontrol system into an 'overloaded' state. When overloaded, the system employs the backoff strategy set above to schedule the next retry of the gather method. As long as the system is overloaded no new data will be processed.</td>
    </tr>
    <tr>
        <td>maxRuns</td>
        <td>no</td>
        <td>A hard limit on the number of calls to the gather method to make.</td>
    </tr>
</table>

 