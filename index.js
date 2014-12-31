var Promise = require('bluebird');
var backoff = Promise.promisifyAll(require('backoff'));
var monitor = Promise.promisifyAll(require("os-monitor"));
var moment  = require('moment');
var R       = require('ramda');

exports.cruisecontrol = function(config) {

    var overloaded = null;
    var numRuns = 0;

    var scope = config.scope;

    // Compose pipeline functions into a single Promisified function
    var pipeline = function(x) { return x; };
    if(config.pipeline.length > 0) {
        pipeline = R.pPipe(config.pipeline[0]);
        for(var i=1;i<config.pipeline.length;i++) {
            pipeline = R.pPipe(pipeline,config.pipeline[i]);
        }
    }

    var summary = null;
    if(config.summary.length > 0) {
        summary = R.pPipe(config.summary[0]);
        for(var i=1;i<config.summary.length;i++) {
            summary = R.pPipe(summary,config.summary[i]);
        }
    }

    var next = function() {
        if(overloaded === null) {
            var items = config.gather();
            if(items.length > 0) {
                numRuns++;

                var transformed = R.map(pipeline, items);

                if(summary) {
                    summary(transformed);
                }

                next();
            }
        } else {
            queueBackoff.backoff();
        }
    };

    // This controls whether the global overloaded state variable
    // is set to none or the moment the system became overloaded.
    monitor.on('monitor', function(event) {
        var mem_state = event.freemem/event.totalmem;
        var cpu_state = event.loadavg[0];

        if(mem_state < config.threshold.mem &&
           cpu_state < config.threshold.cpu) {
            overloaded = null;
        } else {
            overloaded = moment();
        }
    });



    var queueBackoff = backoff.fibonacci({
        randomisationFactor: 0,
        initialDelay: 10,
        maxDelay: 3000
    });

    queueBackoff.on('ready', function(number, delay) {
        next();
    });

    return {
        pause: function() { overloaded = moment(); },
        getOverloaded: function() { return overloaded; },
        getNumRuns:  function() { return numRuns; },
        next: function() { next(); } ,
        start: function() {
            monitor.start({
                delay: ((config.max_delay*1000)/2),
                immediate: true
            });

            next();
        },
        stop: function() {
            console.log('stopping');
        }
    };
};