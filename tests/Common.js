// Keep track of the number of times the gather function was run so we can terminate the test
// Since this is a threadded app its worth noting that gather functions are only run in the 
// primary thread.
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

// Function that processes the data. It's worth noting that these are run in seperate threads so
// don't use global variables here. Use Summary and Final functions instead if you need to do
// something that involves global variables in the same space as the gather function.
var addOne = function(item) {
    return item+1;
};

// Function that processes the result of one pipeline run.
var avg = function(items) {
    var total = 0;
    var len   = items.length;
    for(var i=len-1;i>=0;i--) {
        total += items[i];
    }
    return total/len;
};

var getConfig = function() {
    var config = {
        strategy: {
            type:'fib',     // [Optional] The backoff strategy to use. 'fib' for fibbonacci and 'exp' for expotential
            options: null   // [Optional] The backoff configuration to use. For more information on this see https://github.com/MathieuTurcotte/node-backoff
        },
        loop: false,        // Whether to continue polling, with backoff, for new records
        gather: gather,     // Singular method for gathering a batch of items to process
        pipeline: [addOne], // Array of functions to perform row-level work
        summary: [avg],     // [Optional] Array of functions to apply in-order to the aggregated output of the pipeline
        finish: null,       // [Optional] Function to call when gather returns an empty set
        threads: 1,         // [Optional] Number of threads to use to process the workload
                            //            The number of items returned by the gather function will
                            //            be divided by the number of worker threads so that each
                            //            thread gets a roughly equal chunk of data to work on
        threshold: {
            mem: 0.8,       // Percentage of memory which must be free. In this example it's 80%
            cpu: 4          // Load average in the last 5 minutes that the CPU must be under
        }
    };
    return config;
};

exports.Common = {
    gather:gather,
    addOne:addOne,
    avg:avg,
    getConfig:getConfig
};