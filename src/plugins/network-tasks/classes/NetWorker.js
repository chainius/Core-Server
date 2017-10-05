const missive       = require('missive');

class NetWorker {

    constructor(discovery) {
        this.threads   = 1;
        this.discovery = discovery;
        this.disconnectListeners = [];
    }

    setSocket(socket) {
        this.socket = socket;

        this.socket.once('close', function() {
            this.disconnected();
        }.bind(this));

        const parse  = missive.parse();
        const encode = missive.encode();

        encode.pipe(socket);
        socket.pipe( parse ).on('message', obj => {
            if(!obj)
                return;
            if(obj.event)
                this.discovery.emit(obj.event, obj.argv || {}, this);

            if(obj.event === 'threads')
                this.onThreads(obj.argv);
        });

        socket.encoder = encode;
        socket.workerThreads = socket.workerThreads || 0;
    }

    setWorker(worker) {
        this.worker = worker;

        this.worker.on('restart', function() {
            this.disconnected();
        }.bind(this));

        worker.on('message', function(obj) {
            if(!obj)
                return;
            if(obj.event)
                this.discovery.emit(obj.event, obj.argv || {}, this);
        }.bind(this));
    }

    send(event, argv) {
        try {
            const data = {
                event: event,
                argv:  argv
            };

            if(this.worker)
                this.worker.sendMessage(JSON.stringify(data));
            else
                this.socket.encoder.write(data);
        } catch(e) {
            console.error(e);
        }
    }

    disconnected() {
        for(var key in this.disconnectListeners) {
            try {
                this.disconnectListeners[key]();
            } catch(e) {
                console.error(e);
            }
        }
    }

    onDisconnected(cb) {
        this.disconnectListeners.push(cb);
        /*if(this.worker)
            return this.worker.once('restart', cb);
        else
            return this.socket.once('close', cb);*/
    }

    removeListener(cb) {

        const index = this.disconnectListeners.indexOf(cb);
        if(index !== -1)
            this.disconnectListeners.slice(index, 1);

        /*if(this.worker)
            return this.worker.removeListener('restart', cb);
        else
            return this.socket.removeListener('close', cb);*/
    }

    onThreads(threads) {
        const val = parseInt(threads);

        if(!isNaN(val))
            this.threads = threads;
    }

}

module.exports = NetWorker;