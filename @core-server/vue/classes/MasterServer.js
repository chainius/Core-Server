const cluster = require('cluster')

if(cluster.isWorker) {
    module.exports = SuperClass
    return
}

var BundleStarted = false

class MasterServer extends SuperClass {

    constructor(config) {
        super(config)

        if(process.env.NODE_ENV === 'development' && process.options['disable-ui'] === undefined)
            this.startVueBundler()
    }

    startVueBundler() {
        if(BundleStarted)
            return

        function spawn(mode) {
            const worker = new SuperClass.Worker({
                cli: JSON.stringify({
                    bundle: mode,
                    hot:    true
                }),
                NODE_ENV: process.env.NODE_ENV
            })

            return worker
        }

        this.clientWorker = spawn('client')
        this.serverWorker = spawn('server')

        this.clientWorker.worker.on('message', function(msg) {
            if (msg.SocketServer && msg.method && msg.data) {
                for (var key in cluster.workers) {
                    if (cluster.workers[key].id !== msg.SocketServer)
                        cluster.workers[key].send(msg)
                }
            }
        })
    }

}

module.exports = MasterServer