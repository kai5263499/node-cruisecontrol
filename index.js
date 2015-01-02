var backoff = require('backoff');
var monitor = require("os-monitor");
var moment  = require('moment');
var R       = require('ramda');

exports.cruisecontrol = function(config) {

    var backedoff   = false;
    var lock        = false; // Prevent next from running while another next session is running
    var overloaded  = null;  // Moment of when the system became overloaded. Otherwise null
    var numRuns     = 0;


    // Compose pipeline functions into a single Promisified function
    var pipeline = function(x) { return x; };
    if(R.isArrayLike(config.pipeline) && !R.isEmpty(config.pipeline)) {
        pipeline = R.pPipe(config.pipeline[0]);
        for(var i=1;i<config.pipeline.length;i++) {
            pipeline = R.pPipe(pipeline,config.pipeline[i]);
        }
    }

    var summary = null;
    if(R.isArrayLike(config.summary) && !R.isEmpty(config.summary)) {
        summary = R.pPipe(config.summary[0]);
        for(var s=1;s<config.summary.length;s++) {
            summary = R.pPipe(summary,config.summary[s]);
        }
    }

    var set = function(key,val) { config[key] = val; };

    var next = function() {
        if(lock === true || backedoff === true) {
            return;
        } else {
            lock = true;
        }

        if(overloaded === null) {
            var items = config.gather();
            if(items.length > 0) {
                numRuns++;

                var transformed = R.map(pipeline, items);

                if(!R.isEmpty(summary) &&
                   !R.isEmpty(transformed) &&
                   typeof summary === 'function') {
                    summary(transformed);
                }

                lock = false;
                next();
            } else {
                if(typeof config.finish == 'function') { config.finish(); }
            }

            lock = false;
            if(config.loop === true && !backedoff) {
                queueBackoff.backoff();
            }
        } else {
            lock = false;
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

    var queueBackoff;
    if(R.isEmpty(config.strategy) || config.strategy.type === 'fib') {
        var fibConfig = {
            randomisationFactor: 0,
            initialDelay: 10,
            maxDelay: 30000
        };
        if(!R.isEmpty(config.strategy.config)) {
            fibConfig = R.mixin(fibConfig,config.strategy.config);
        }

        queueBackoff = backoff.fibonacci(config);
    } else {
        var expConfig = {
            randomisationFactor: 0,
            initialDelay: 10,
            maxDelay: 30000,
            factor: 2
        };
        if(!R.isEmpty(config.strategy.config)) {
            expConfig = R.mixin(expConfig,config.strategy.config);
        }
        queueBackoff = backoff.exponential(expConfig);
    }

    queueBackoff.on('backoff', function(number, delay) {
        backedoff = true;
    });

    queueBackoff.on('ready', function(number, delay) {
        backedoff = false;
        next();
    });

    return {
        setOverloaded: function(val) { overloaded = val; },
        getOverloaded: function() { return overloaded; },
        getNumRuns:  function() { return numRuns; },
        next: next,
        set: set,
        start: function(force) {
            monitor.start({
                delay: ((config.max_delay*1000)/2),
                immediate: true
            });

            if(force === true) {
                lock = false;
            }

            next();
        },
        stop: function() {
            monitor.stop();
            lock = true;
        }
    };
};