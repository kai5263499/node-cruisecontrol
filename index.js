/*jslint node: true */
'use strict';

var Promise = require('bluebird');
var backoff = require('backoff');
var monitor = require("os-monitor");
var moment  = require('moment');
var R       = require('ramda');
var cluster = require('cluster');
var Emitter = require('emitter');

function Cruisecontrol(config) {
    monitor.setMaxListeners(20);

    var queueBackoff;
    var pipeline;
    var summary     = null;
    var backedoff   = false;
    var lock        = false; // Prevent next from running while another next session is running
    var overloaded  = null;  // Moment of when the system became overloaded. Otherwise null
    var numRuns     = 0;
    var maxRuns     = R.isEmpty(config.maxRuns) ? -1 : config.maxRuns;
    var threads     = R.isEmpty(config.threads) ? 1  : config.threads;
    var workersOnline = 0;
    var workerPtr   = 0;
    var workers     = [];
    var transformed = [];
    var summaries   = [];
    var completed   = 0;
    var finish;

    var PASSTHROUGH = Promise.method(function(x) { return x; });

    var handleWorkerMessage = function(msg) {
        if(msg.type === 'started') {
            workersOnline++;
            if(workersOnline === threads) {
                next();
            }
        } else if(msg.type === 'completed') {
            completed++;

            transformed = transformed.concat(msg.transformed);

            if(completed === workers.length) {
                if(summary !== null &&
                   !R.isEmpty(transformed) &&
                   typeof summary === 'function') {
                   
                   return summary(transformed)
                        .then(function(summaryItems) {
                            postProcessItems(summaryItems);
                        });
                } else {
                    return postProcessItems(transformed);
                }
            }

            this.emit('workCompleted', msg);
        }
    };

    var stop = function(cb) {
            monitor.stop();
            lock = true;
            var numWorkers = workers.length;
            while(numWorkers--) {
                workers[numWorkers].kill();
            }
        };

    var ComposePipeline = function() {
        // Compose pipeline functions into a single Promisified function
        if(!R.isEmpty(config.pipeline)) {
            if(R.isArrayLike(config.pipeline)) {
                pipeline = Promise.method(R.pPipe(config.pipeline[0]));
                for(var i=1;i<config.pipeline.length;i++) {
                    var promisified = Promise.method(config.pipeline[i]);
                    pipeline = R.pPipe(pipeline,promisified);
                }
            } else if(typeof config.pipeline === 'function') {
                pipeline = Promise.method(config.pipeline);
            } else {
                pipeline = PASSTHROUGH;
            }
        } else {
            pipeline = PASSTHROUGH;
        }
    };

    var ComposeSummary = function() {
        if(config.summary !== null) {
            if(R.isArrayLike(config.summary)) {
                summary = Promise.method(R.pPipe(config.summary[0]));
                for(var s=1;s<config.summary.length;s++) {
                    summary = Promise.method(R.pPipe(summary,config.summary[s]));
                }
            } else {
                if(typeof config.summary === 'function') {
                    summary = Promise.method(config.summary);
                }
            }
        } else {
            summary = null;
        }
    };

    var ComposeFinish = function() {
        if(typeof config.finish === 'function') {
            finish = Promise.method(R.pPipe(config.finish,stop));
        } else {
            finish = Promise.method(stop);
        }
    };

    new ComposePipeline();
    new ComposeSummary();
    new ComposeFinish();

    var setOverloaded = function(val) {
        overloaded = val;
    };
    var getOverloaded = function() { return overloaded; };
    var getNumRuns    = function() { return numRuns; };
    var next = function() {
        if(lock === true || backedoff === true) {
            return;
        } else {
            lock = true;
        }

        if(overloaded === null) {
            var res = config.gather();
            if(typeof res.then === 'function') {
                return res.then(processItems);
            } else if(R.isArrayLike(res)) {
                return processItems(res);
            }
        } else {
            lock = false;
            queueBackoff.backoff();
        }
    };
    var processItems = function(items) {
        if(items.length > 0) {
            numRuns++;
            var numWorkers = workers.length;
            if(1 < numWorkers) {
                var blocksize = Math.ceil(items.length/workers.length);
                
                completed = 0;
                transformed = [];

                while(numWorkers--) {
                    var block = items.splice(0,blocksize);
                    workers[workerPtr].send(block);

                    workerPtr++;
                    if(workerPtr >= numWorkers) {
                        workerPtr = 0;
                    }
                }
            } else {
                Promise.all(R.map(pipeline, items))
                    .then(function(items) {
                        if(typeof summary === 'function') {
                           return summary(items)
                                .then(function(items) {
                                    postProcessItems(items);
                                });
                        } else {
                            return postProcessItems(items);
                        }
                    });
            }
        } else {
            lock = false;
            if(!backedoff) {
                if(config.loop === true) {
                    queueBackoff.backoff();
                } else if(typeof finish === 'function') {
                    summaries = summaries.concat(items);
                    return finish(summaries);
                }
            }
        }
    };
    var postProcessItems = function(items) {
        summaries = summaries.concat(items);
        var maxRunsExceeded = (maxRuns !== -1 && numRuns >= maxRuns);
        if(((R.isArrayLike(items) && items.length === 0) || maxRunsExceeded) &&
            typeof finish === 'function') {
            return finish(summaries);
        } else {
            lock = false;
            return next();
        }
    };
    var set  = function(key,val) {
        config[key] = val;
        if(key === 'pipeline') {
            new ComposePipeline();
        } else if(key === 'summary') {
            new ComposeSummary();
        } else if(key === 'finish') {
            new ComposeFinish();
        }
    };

    var start= function(force) {
        workerPtr = 0;
        numRuns = 0;
        summaries = [];

        monitor.start({
            delay: ((config.max_delay*1000)/2),
            immediate: true
        });

        if(force === true) {
            lock = false;
        }

        if(1 < threads) {
            if(cluster.isMaster) {
                var t = threads;
                while(t--) {
                    var worker = cluster.fork();
                    worker.on('message', handleWorkerMessage);
                    workers.push(worker);
                }
            } else if(cluster.isWorker) {
                process.on('message', function(items) {
                    Promise.all(R.map(pipeline, items))
                        .then(function(transformed) {
                            process.send({
                                "type":"completed",
                                "pid":process.pid,
                                "transformed":transformed
                            });
                        });
                });

                process.send({"type":"started"});
            }
        } else {
            next();
        }
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
            this.emit('overloaded', event);
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
        this.emit('queueBackoff', {'number':number, 'delay':delay});
    });

    queueBackoff.on('ready', function(number, delay) {
        backedoff = false;
        this.emit('queueReady', {'number':number, 'delay':delay});
        next();
    });

    this.setOverloaded = setOverloaded;
    this.getOverloaded = getOverloaded;
    this.getNumRuns    = getNumRuns;
    this.next          = next;
    this.start         = start;
    this.set           = set;
}

new Emitter(Cruisecontrol.prototype);

module.exports = Cruisecontrol;