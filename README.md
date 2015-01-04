cruisecontrol
=========

This is a simple [negative feedback closed loop control system](http://en.wikipedia.org/wiki/Negative_feedback "Closed Loop Control System"). This takes as its input the system's CPU and memory usage load parameters and regulates the frequency of the (gather -> pipeline) operation as a closed loop. The purpose of this module is to ensure smooth(ish) system performance using a [backoff strategy](http://en.wikipedia.org/wiki/Exponential_backoff Expotential Backoff) to allivieate system load pressure while processing a large amount of data.

## Installation

	npm install cruisecontrol --save

## Usage
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
        threshold: {
            mem: 0.7,       // Percentage of memory which must be free
            cpu: 2          // Load average in the last 5 minutes that the CPU must be under
        }
    };

	var cruisecontrol = new require('cruisecontrol').cruisecontrol(config);
    cruisecontrol.start();