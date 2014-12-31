cruisecontrol
=========

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
        gather: gather,     // Singular method for gathering a batch of items to process
        pipeline: [addOne], // Array of functions to perform row-level work, functions are applied left to right
        summary: [avg],     // [Optional] Array of functions to apply in-order to the aggregated output of the pipeline, functions are applied left to right
        threshold: {
            mem: 0.7,       // Percentage of memory which must be free
            cpu: 2          // Load average in the last 5 minutes that the CPU must be under
        }
    };

	var cruisecontrol = new require('cruisecontrol').cruisecontrol(config);
    cruisecontrol.start();