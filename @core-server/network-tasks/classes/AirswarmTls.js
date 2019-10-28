const Discovery = plugins.require('network-tasks/Discovery');
const net       = require('tls');
const Crypter   = plugins.require('http/Crypter');
const iv        = 'core-server@12$3';

class AirswarmTls {

    constructor(tlsOptions, identifier, fn) {
        this.discovery  = new Discovery();
        this.limit      = Infinity;
        this.identifier = identifier;
        this.connections = {};
        this.tlsOptions = tlsOptions;

        this.start(tlsOptions);

        const port = this.server.address().port;
        console.log('Starting airwarm on port', port)
        this.discovery.local(identifier, port);

        this.nonce = Crypter.sha1Hex((this.discovery.id + Math.random()).toString());

        if(process.options.discoveryPort || process.env.discoveryPort) {
            this.discovery.listenKubernetes({
                port: port
            });
        }

        if (fn)
            this.server.on('peer', fn);
    }

    start(tlsOptions) {
        this.server = net.createServer(tlsOptions, function (sock) {
            sock.on('error', function (err) {
                sock.destroy(err)
            })

            this.getAuth(sock, function() {
                this.track(sock);
            }.bind(this), 'auth');
        }.bind(this))

        this.server.peers = []

        this.server.on('error', function(err) {
            console.error(err);
        }).on('clientError', function(err, conn) {
            console.error('clientError', err);
        });

        this.server.on('listening', function () {
            this.discovery.on('addr', function(host, port) {
                this.connect(host, port);
            }.bind(this));
        }.bind(this));

        this.server.listen(parseFloat(process.options.discoveryPort || process.env.discoveryPort || 0));
    }

    getId() {
        return this.discovery.id;
    }

    track(sock) {
        if (this.server.peers.length >= this.limit)
            return sock.destroy();

        this.server.peers.push(sock)
        sock.on('close', function () {
            this.server.peers.splice(this.server.peers.indexOf(sock), 1)
        }.bind(this));

        this.server.emit('peer', sock);
    }

    auth(socket, cb) {
        socket.write(Crypter.encrypt('auth-' + this.nonce, this.identifier, iv));
        this.getAuth(socket, cb, 'rauth');
    }

    getAuth(socket, cb, msgR) {
        const timeOut = setTimeout(function() {
            socket.destroy('auth not received');
        }, 5000);

        socket.once('data', function(data) {
            clearTimeout(timeOut);

            try {
                const res = Crypter.decrypt(data.toString(), this.identifier, iv);

                if(res.substr(0, msgR.length + 1) === msgR + '-') {
                    socket.nonce = res.substr(msgR.length + 1);

                    if(msgR === 'auth') {
                        socket.write(Crypter.encrypt('rauth-' + this.nonce, this.identifier, iv));
                    }

                    cb(socket);
                } else {
                    socket.destroy('Wrong auth received');
                }
            } catch(e) {
                socket.destroy(e);
            }
        }.bind(this))
    }

    connect(host, port, force) {
        const remoteId = host + ':' + port;
        if (remoteId === this.discovery.id) return;
        if (this.connections[remoteId]) return;
        if (remoteId < this.discovery.id) return this.discovery.dnsRespond();

        const options = JSON.parse(JSON.stringify(this.tlsOptions));
        options.host = host;
        options.port = port;

        const sock = this.connections[remoteId] = net.connect(port, options);

        sock.on('error', function (err) {
            console.error(err);
            sock.destroy()
        })

        sock.on('close', function () {
            delete this.connections[remoteId]
        }.bind(this));

        this.auth(sock, function() {
            this.track(sock);
        }.bind(this));
    }
}

module.exports = AirswarmTls;