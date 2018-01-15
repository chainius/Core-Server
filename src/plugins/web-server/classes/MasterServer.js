'use strict';

const cluster       = require('cluster');
const EventEmitter  = require('events');
const net           = require('net');

//cluster.schedulingPolicy = cluster.SCHED_NONE;

function getAppVersion(basePath) {
    const Path = require('path');
    try {
        return require(Path.join(basePath, 'package.json')).version || 'dev';
    } catch(e) {
        if(e.code === 'MODULE_NOT_FOUND')
            return 'dev';

        throw(e);
    }
}

class MasterServer
{
    constructor()
    {
        //this.config           = config || {};
        this.workers          = [];
        this.roundIncrement   = 0;
        this.balancingMethode = this.handleRoundRobinSocket;
        this.threads          = process.options.threads || ((process.env.NODE_ENV === 'production') ? require('os').cpus().length : 1);
        this.isMaster         = true;

        //if(this.threads > 1 || process.options.forceCluster !== undefined)
        //    this.start(process.options.port || 8080);

        console.info('Setup using', this.threads, 'threads');
        this.updateWorkers();
    }

    start(port)
    {
        this.port = port || 80;

        console.info('Starting server on port', this.port, 'with version:', getAppVersion(process.cwd()));

        const _this = this;

        this.socket = net.createServer({ pauseOnConnect: true }, function( socket )
        {
            _this.handleSocket(socket);
        });

        this.socket.on('error', (e) =>
        {
            console.error('Master socket server error', e.code, e.message);
        });

        //server.on('listening', (e) => { });

        this.socket.on('close', (e) =>
        {
            console.warn('Master server closed');
        });

        //server.on('connection', (e) => {});

        this.socket.listen(port);
    }

    stop()
    {
        try {
            if(this.socket === null)
                return;

            this.socket.close();
            this.socket = null;
        }
        catch(e) {
            console.error(e);
        }
    }

    //---------------------------------------------------------------
    //Workers Manager

    handleStickySocket(socket)
    {
        /*const address = socket.remoteAddress;
        const digest  = hasher.h32(0xABCD).update(address || '').digest();
        const idx     = digest % this.workers.length;

        this.workers[idx].handleSocket(socket);*/
    }

    handleRoundRobinSocket(socket)
    {
        this.workers[this.roundIncrement].handleSocket(socket);
        this.roundIncrement = (this.roundIncrement >= this.workers.length - 1) ? 0 : this.roundIncrement + 1;
    }

    handleReverseProxySocket(socket)
    {
        /*socket.once('data', function(buffer)
        {
            try
            {
                const parser = parsers.alloc();
                parser.reinitialize(HTTPParser.REQUEST);
                parser.onIncoming = function(req)
                {
                    try
                    {
                        const address = getClientIpFromHeaders(req, socket);
                        const digest  = hasher.h32(0xABCD).update(address).digest();
                        const idx     = digest % that.workers.length;

                        socket.pause();
                        that.workers[idx].handleSocket(socket, buffer);
                    }
                    catch (e)
                    {
                        console.error(e);
                    }
                };

                parser.execute(buffer, 0, buffer.length);
                parser.finish();
            }
            catch (e)
            {
                console.error(e);
            }
        });

        socket.resume();*/
    }

    handleSocket(socket)
    {
        socket.on('error', function(exception)
        {
            //console.error(exception);
            socket.destroy();
        });

        /*var killtimer = setTimeout(function()
        {
            try
            {
                if(!socket.destroyed)
                {
                    var errorMessage = 'HTTP/1.1 200 OK\nContent-Type: text/html\nConnection: close\n\nAn internal error occurded, the main server detected a timeout';
                    console.log('Socket destroyed in master after timeout');
                    socket.resume();
                    socket.write(errorMessage);
                    socket.setKeepAlive(false, 100);
                    socket.destroy();
                    socket.unref();
                }
            }
            catch(e)
            {
                console.error(e);
            }
        }, 7 * 1000); //Socket 7 seconds timeout

        killtimer.unref();*/
        this.balancingMethode(socket);
    }

    sendMessage(command, data)
    {
        this.workers[this.roundIncrement].sendMessage(command, data);
        this.roundIncrement = (this.roundIncrement >= this.workers.length - 1) ? 0 : this.roundIncrement + 1;
    }

    startWorker()
    {
        try
        {
            const worker = new MasterServer.Worker();
            this.workers.push(worker);
            //this.argentDiscovery.reigsterWorker(worker);
            return worker;
        }
        catch (e)
        {
            console.error(e);
        }

        return null;
    }

    updateWorkers()
    {
        for (var i = this.workers.length; i < this.threads; i++)
        {
            try
            {
                this.startWorker();
            }
            catch (e)
            {
                console.error(e);
            }
        }
    }

    restartWorkers()
    {
        for (var i = 0; i < this.threads; i++)
        {
            try
            {
                this.workers[i].restart();
            }
            catch (e)
            {
                console.error(e);
            }
        }
    }
}

class Worker extends EventEmitter
{
    constructor(env)
    {
        super();
        this.worker = null;
        this.env = env || process.env;
        this.initWorker();
    }

    debug(message)
    {
        //console.log(message);
    }

    onMessage(message)
    {
        this.emit('message', message);

        if (message == 'restartWorker')
            this.restart();
        else if(typeof(message) === 'object' && message.type == 'gracefull-exit')
            process.exit(message.code || 0);
    }

    unbindWorker()
    {

    }

    isLastPid(worker)
    {
        return (this.worker.process.pid == worker.process.pid);
    }

    initWorker()
    {
        var that = this;

        if (this.worker != null)
        {
            try
            {
                //worker.exit(1);
                this.unbindWorker(this.worker);
                this.worker.kill();
            }
            catch (e)
            {
                console.error(e);
            }

            this.worker = null;
        }

        this.worker = cluster.fork(this.env);

        this.worker.on('exit', function()
        {
            if (!that.isLastPid(this))
                return;

            that.emit('restart', that);
            that.unbindWorker(that.worker);
            that.initWorker();
        });

        this.worker.on('message', function(msg)
        {
            if (!that.isLastPid(this))
                return;

            that.onMessage(msg);
        });

        /*this.worker.on('listening', function()
        {
            if(!that.isLastPid(this))
                return;

            //..
        });

        this.worker.on('online', function()
        {
            that.debug("Worker is online");
        });

        this.worker.on('disconnect', function()
        {
            that.debug("Worker disconnected");
        });

        this.worker.on('error', function(e)
        {
            that.debug("Worker error", e);
        });*/
    }

    onConnected()
    {
        var that = this;
        return new Promise(function(resolve, reject)
        {
            function check()
            {
                if (that.worker != null)
                {
                    if (that.worker.isConnected())
                        return resolve(that.worker);
                }
                else
                {
                    that.initWorker();
                }

                setTimeout(check, 2);
            }

            check();
        });
    }

    handleSocket(socket, predata)
    {
        this.sendMessage(['socket', predata], socket);
    }

    sendMessage(command, data)
    {
        this.onConnected().then(function(worker)
        {
            worker.send(command, data);
        })
        .catch(function(e)
        {
            console.error('Onconnected error', e);
        });
    }

    restart()
    {
        this.initWorker();
    }
};

if(cluster.isWorker)
{
    process.coreExit = function(code) {
        process.send({
            type: 'gracefull-exit',
            code: code
        })
    }
    
    const Server = plugins.require('web-server/HttpServer');
    Server.Worker = Worker;
    module.exports = Server;
    return;
}

MasterServer.Worker = Worker;
module.exports      = MasterServer;