const multicastdns   = require('multicast-dns')
const net            = require('tls')
const addr           = require('network-address');
const Crypter        = require('../crypter.js');
const iv             = 'core-server@12$3';

process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";

module.exports = function airswarm(tlsOptions, name, opts, fn) {
    if (typeof opts === 'function') return airswarm(tlsOptions, name, null, opts)
    if (!opts) opts = {}

    var limit = opts.limit || Infinity
    var mdns = multicastdns()
    var connections = {}

    function auth(socket, cb) {
        socket.write(Crypter.encrypt('auth', name, iv));
        getAuth(socket, cb, 'rauth');
    }

    function getAuth(socket, cb, msgR) {
        const timeOut = setTimeout(function() {
            socket.destroy('auth not received');
        }, 5000);

        socket.once('data', function(data) {
            clearTimeout(timeOut);

            try {
                const res = Crypter.decrypt(data.toString(), name, iv);

                if(res === msgR) {
                    if(msgR === 'auth')
                        socket.write(Crypter.encrypt('rauth', name, iv));

                    cb(socket);
                } else {
                    socket.destroy('Wrong auth received');
                }
            } catch(e) {
                socket.destroy(e);
            }
        })
    }

    var server = net.createServer(tlsOptions, function (sock) {
        sock.on('error', function (err) {
            sock.destroy(err)
        })

        getAuth(sock, function() {
            track(sock)
        }, 'auth');
    })

    server.peers = []

    function track(sock) {
        if (server.peers.length >= limit) return sock.destroy()
        server.peers.push(sock)
        sock.on('close', function () {
            server.peers.splice(server.peers.indexOf(sock), 1)
        })
        server.emit('peer', sock)
    }

    server.on('error', function(err) {
        console.error(err);
    }).on('clientError', function(err, conn) {
      console.error('clientError', err);
    });

    server.on('listening', function () {
        var host = addr()
        var port = server.address().port
        var id = host + ':' + port

        mdns.on('query', function (q) {
            for (var i = 0; i < q.questions.length; i++) {
                var qs = q.questions[i]
                if (qs.name === name && qs.type === 'SRV') return respond()
            }
        })

        mdns.on('response', function (r) {
            for (var i = 0; i < r.answers.length; i++) {
                var a = r.answers[i]
                if (a.name === name && a.type === 'SRV') connect(a.data.target, a.data.port)
            }
        })

        update()
        var interval = setInterval(update, 3000)

        server.on('close', function () {
            clearInterval(interval)
        })

        function respond() {
            mdns.response([{
                name: name,
                type: 'SRV',
                data: {
                    port: port,
                    weigth: 0,
                    priority: 10,
                    target: host
                }
      }])
        }

        function update() {
            if (server.peers.length < limit) mdns.query([{
                name: name,
                type: 'SRV'
            }])
        }

        function connect(host, port) {
            var remoteId = host + ':' + port
            if (remoteId === id) return
            if (connections[remoteId]) return
            if (remoteId < id) return respond()

            const options = JSON.parse(JSON.stringify(tlsOptions));
            options.host = host;
            options.port = port;

            var sock = connections[remoteId] = net.connect(port, options);

            sock.on('error', function (err) {
                console.error(err);
                sock.destroy()
            })

            sock.on('close', function () {
                delete connections[remoteId]
            })

            auth(sock, function() {
                track(sock);
            });
        }
    })

    if (fn) server.on('peer', fn)
    server.listen(0)

    return server
}
