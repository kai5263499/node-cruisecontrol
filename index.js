var Promise = require('bluebird');
var backoff = require('backoff');
var monitor = require("os-monitor");
var moment  = require('moment');
var R       = require('ramda');

function Cruisecontrol(config) {
    monitor.setMaxListeners(20);

    var queueBackoff;
    var pipeline;
    var summary     = null;
    var backedoff   = false;
    var lock        = false; // Prevent next from running while another next session is running
    var overloaded  = null;  // Moment of when the system became overloaded. Otherwise null
    var numRuns     = 0;
    var finish;

    var stop = function(cb) {
            monitor.stop();
            lock = true;
        };

    var ComposePipeline = function() {
        // Compose pipeline functions into a single Promisified function
        if(R.isArrayLike(config.pipeline) && !R.isEmpty(config.pipeline)) {
            pipeline = Promise.method(R.pPipe(config.pipeline[0]));
            for(var i=1;i<config.pipeline.length;i++) {
                var promisified = Promise.method(config.pipeline[i]);
                pipeline = R.pPipe(pipeline,promisified);
            }
        } else {
            pipeline = Promise.method(this.PASSTHROUGH);
        }
    };

    var ComposeSummary = function() {
        if(R.isArrayLike(config.summary) && !R.isEmpty(config.summary)) {
            summary = Promise.method(R.pPipe(config.summary[0]));
            for(var s=1;s<config.summary.length;s++) {
                summary = Promise.method(R.pPipe(summary,config.summary[s]));
            }
        }
    };

    var ComposeFinish = function() {
        if(typeof config.finish === 'function') {
            finish = Promise.method(R.pPipe(config.finish,stop));
        } else {
            finish = Promise.method(stop);
        }
    };

    ComposePipeline();
    ComposeSummary();
    ComposeFinish();

    var setOverloaded = function(val) { overloaded = val; };
    var getOverloaded = function() { return overloaded; };
    var getNumRuns    = function() { return numRuns; };
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
            }

            lock = false;
            if(!backedoff) {
                if(config.loop === true) {
                    queueBackoff.backoff();
                } else if(items.length === 0 && typeof finish === 'function') {
                    finish();
                }
            }
        } else {
            lock = false;
            queueBackoff.backoff();
        }
    };
    var set  = function(key,val) {
        config[key] = val;
        if(key === 'pipeline') {
            ComposePipeline();
        } else if(key === 'summary') {
            ComposeSummary();
        } else if(key === 'finish') {
            ComposeFinish();
        }
    };
    var start= function(force) {
            monitor.start({
                delay: ((config.max_delay*1000)/2),
                immediate: true
            });

            if(force === true) {
                lock = false;
            }

            next();
        };

    // This controls whether the global overloaded state variable
    // is set to none or the moment the system became overloaded.
    var stateMonitor = function(event) {
        var mem_state = event.freemem/event.totalmem;
        var cpu_state = event.loadavg[0];

        if(mem_state < config.threshold.mem &&
           cpu_state < config.threshold.cpu) {
            overloaded = null;
        } else {
            overloaded = moment();
        }
    };
    monitor.on('monitor', stateMonitor);

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

    this.setOverloaded = setOverloaded;
    this.getOverloaded = getOverloaded;
    this.getNumRuns    = getNumRuns;
    this.next          = next;
    this.start         = start;
    this.set           = set;
}

Cruisecontrol.prototype.PASSTHROUGH = function(x) { return x; };

module.exports = Cruisecontrol;