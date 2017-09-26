const airswarm = plugins.require('network-tasks/AirswarmTls')
const missive  = require('missive');
const fs       = require('fs');
const Path     = require('path');
const EventEmitter = require('events');

class NetworkDiscovery extends EventEmitter {

    constructor(identifier) {
        super();

        const _this = this;
        this.incrementalWorkIndex = 0;
        this.workers = [];
        this.workerCallbacks = {};
        this.internalCallbacks = {};

        if(identifier) {
            const tlsOptions = {
                key: fs.readFileSync(Path.join(process.cwd(), 'ssl', 'cert-key.pem')),
                cert: fs.readFileSync(Path.join(process.cwd(), 'ssl', 'cert.pem')),
                requestCert: true,
                ca: fs.readFileSync(Path.join(process.cwd(), 'ssl', 'ca.pem'))
            };

            this.server = airswarm(tlsOptions, identifier, function(sock) {
                try {
                    _this.onSocket(sock);
                    _this.emit('socket', sock);
                }
                catch(e) {
                    console.error(e);
                }
            });
        }

        this.on('threads', this.onThreads);
        this.on('task', this.onTask);
        this.on('task-response', this.onTaskResponse);
    }

    getPeers() {
        if(!this.server)
            return [];

        return this.server.peers;
    }

    onSocket(socket) {
        const parse  = missive.parse();
        const encode = missive.encode();
        const _this  = this;

        encode.pipe(socket);
        socket.pipe( parse ).on( 'message', obj => {
            if(obj.type)
            {
                _this.emit(obj.type, socket, obj);
            }
            else if(obj.threads) {
                _this.onThreads(socket, obj.threads);
            }
        });

        socket.encoder = encode;
        socket.workerThreads = socket.workerThreads || 1;

        this.sendToSocket(socket, {
            threads: _this.workers.length
        });
    }

    onThreads(socket, threads) {
        const val = parseInt(threads);

        if(!isNaN(val))
            socket.workerThreads = threads;
    }

    onTask(socket, cmd) {
        const _this = this;
        this.sendInternalTask(cmd.name, cmd.task, cmd.thread || 1, cmd.id).then(function(data)
        {
            _this.sendToSocket(socket, {
                type: 'task-response',
                isError: false,
                id:   cmd.id,
                data: data
            });
        })
        .catch(function(err) {
            _this.sendToSocket(socket, {
                type: 'task-response',
                isError: true,
                id:   cmd.id,
                data: err
            });
        });
    }

    onTaskResponse(socket, cmd) {
        try {
            if(this.workerCallbacks[cmd.id])
                this.workerCallbacks[cmd.id](cmd.data, cmd.isErr);
        } catch(e) {
            console.error(e);
        }
    }

    sendToSocket(socket, message) {
        try {
            socket.encoder.write(message);
        }
        catch(e) {
            console.error(e);
        }
    }

    sendTask(name, task) {
        var index = this.incrementalWorkIndex;
        this.incrementalWorkIndex++;

        const id  = index + '_' + Math.random() + 'work' + Math.random();

        if(index < this.workers.length) {
            return this.sendInternalTask(name, task, index, id);
        }

        index -= this.workers.length;

        const peers  = this.getPeers();
        var executed = false;

        for(var i=0; i<peers.length; i++) {
            if(peers[i].workerThreads > index) {
                this.sendToSocket(peers[i], {
                    type:   'task',
                    id:     id,
                    name:   name,
                    thread: index,
                    task:   task
                });

                executed = true;
                break;
            }

            index -= peers[i].workerThreads;
        }

        if(!executed)
        {
            this.incrementalWorkIndex = 0;

            if(this.workers.length === 0 && peers.length === 0)
                return new Promise(function(resolve, reject) { reject('No workers found'); });

            return this.sendTask(name, task);
        }

        const _this = this;
        return new Promise(function(resolve, reject) {
            _this.workerCallbacks[id] = function(data, isError) {

                if(isError)
                    reject(data);
                else
                    resolve(data);

                delete _this.workerCallbacks[id];
            };
        });
    }

    sendInternalTask(name, task, threadIndex, id) {
        if(!threadIndex || threadIndex < 0 || threadIndex >= this.workers.length)
            threadIndex = 0;

        //Return promise
        const _this = this;
        return new Promise(function(resolve, reject) {
            if(!task)
                return reject('The requried task could not be parsed');
            if(_this.workers.length === 0)
                return reject('No internal workers found');
            if(!_this.workers[threadIndex])
                return reject('The required worker could not be found');

            _this.workers[threadIndex].sendMessage({
                type: 'discovery-task',
                name: name,
                id:   id,
                task: task
            });

            _this.internalCallbacks[id] = function(data, isError) {
                delete _this.internalCallbacks[id];

                if(isError)
                    reject(data);
                else
                    resolve(data);
            }
        });
    }

    handleTaskResponse(data) {
        if(this.internalCallbacks[data.id]) {
            this.internalCallbacks[data.id](data.data, data.isError);
        }
    }

    handleTaskRequire(msg, worker) {
        return this.sendTask(msg.name, msg.task).then(function(data) {
            worker.sendMessage({
                type: 'task-response',
                name: msg.name,
                id:   msg.id,
                isError: false,
                data: data
            });
        })
        .catch(function(err) {
            worker.sendMessage({
                type: 'task-response',
                name: msg.name,
                id:   msg.id,
                isError: true,
                data: err
            });
        });
    }

    //--------------
    //Internal cluster workers..?

    onWorkerMessage(msg, worker) {
        if(!msg)
            return;

        if(msg.type === 'task-response')
            this.handleTaskResponse(msg);
        else if(msg.type === 'task')
            this.handleTaskRequire(msg, worker);
    }

    reigsterWorker(worker) {
        this.workers.push(worker);

        const _this = this;
        worker.on('message', function(msg) {
            _this.onWorkerMessage(msg, worker);
        });

        const peers = this.getPeers();

        for(var key in peers) {
            this.sendToSocket(peers[key], {
                threads: this.workers.threads
            });
        }
    }
}

module.exports = NetworkDiscovery;