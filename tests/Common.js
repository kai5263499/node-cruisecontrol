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
    return total/len;
};

var getConfig = function() {
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
        threads: 2,
        threshold: {
            mem: 0.9,       // Percentage of memory which must be free
            cpu: 8          // Load average in the last 5 minutes that the CPU must be under
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