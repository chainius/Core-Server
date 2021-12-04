const argv = require('process-argv')()
const multicastdns = require('multicast-dns')
const EventEmiter = require('events')
const addr = require('network-address')

process.env['NODE_TLS_REJECT_UNAUTHORIZED'] = '0'

class Discovery extends EventEmiter {

    constructor() {
        super()
        this.localDiscovery = null
    }

    //--------------------------------------------
    // Kubernetes discovery

    getFileContent(name, def) {
        try {
            const fs = require('fs')
            const content = fs.readFileSync(name)
            return content.toString()
        } catch(e) {
            if(e.code === 'ENOENT')
                return def

            throw(e)
        }
    }

    getKubernetesPods(core, appName) {
        return new Promise(function(resolve, reject) {
            core.namespaces.pods.get({ qs: { labelSelector: 'app=' + appName } }, function(err, result) {
                if(err)
                    reject(err)
                else
                    resolve(result)
            })
        })
    }

    async kubernetes(config) {
        config = config || {}

        if(!config.server) {
            if(process.env.KUBERNETES_SERVICE_HOST)
                config.server = 'https://' + process.env.KUBERNETES_SERVICE_HOST + ':' + (process.env.KUBERNETES_SERVICE_PORT_HTTPS || process.env.KUBERNETES_SERVICE_PORT)
            else
                config.server = 'http://localhost:8080'
        }

        const Api = require('kubernetes-client')
        const token = this.getFileContent('/var/run/secrets/kubernetes.io/serviceaccount/token', '')
        const coreConfig = {
            url:       config.server,
            version:   'v1',
            namespace: config.namespace || this.getFileContent('/var/run/secrets/kubernetes.io/serviceaccount/namespace', 'default'),
            /* auth: {
                bearer: this.getFileContent('/var/run/secrets/kubernetes.io/serviceaccount/token', '')
            }*/
        }

        if(token !== '')
            coreConfig.auth = { bearer: token }

        const core = new Api.Core(coreConfig)
        config.app = config.app || process.env.appSelector

        if(typeof(config.app) === 'string')
            config.app = config.app.split(',')

        var pods = []
        for(var key in config.app) {
            const subPods = await this.getKubernetesPods(core, config.app[key])

            pods = pods.concat(subPods.items.map(function(obj) {
                return obj.status.podIP
            }).filter(function(obj) {
                return obj !== undefined
            }))
        }

        return pods
    }

    updateKubernetes(config) {
        if(!config.port)
            return

        this.kubernetes(config).then(function(pods) {

            for(var key in pods)
                this.emit('addr', pods[key], config.port)

        }.bind(this)).catch(function(err) {
            console.error(err)
        })
    }

    listenKubernetes(config) {
        this.updateKubernetes(config)

        setInterval(function() {
            this.updateKubernetes(config)
        }.bind(this), config.interval || 10000)
    }

    //--------------------------------------------

    setupLocalDiscovery(identifier, port) {
        if(this.localDiscovery)
            return this.localDiscovery

        this.mdns = multicastdns()
        this.port = port
        this.host = addr()
        this.id = this.host + ':' + this.port
        this.localDiscovery = identifier
        this.mdns.on('query', function (q) {
            for (var i = 0; i < q.questions.length; i++) {
                var qs = q.questions[i]
                if (qs.name === identifier && qs.type === 'SRV')
                    return this.dnsRespond(identifier)
            }
        }.bind(this))

        this.mdns.on('response', function (r) {
            for (var i = 0; i < r.answers.length; i++) {
                var a = r.answers[i]
                if (a.name === identifier && a.type === 'SRV') {
                    this.emit('addr', a.data.target, a.data.port)
                }
            }
        }.bind(this))

        setInterval(function() {
            this.local(identifier)
        }.bind(this), 3000)
    }

    dnsRespond(identifier) {
        this.mdns.response([{
            name: identifier || this.localDiscovery,
            type: 'SRV',
            data: {
                port:     this.port,
                weigth:   0,
                priority: 10,
                target:   this.host
            }
        }])
    }

    local(identifier, port) {
        this.setupLocalDiscovery(identifier, port)

        this.mdns.query([{
            name: identifier,
            type: 'SRV'
        }])
    }

    //--------------------------------------------

    cloudflare(identifier) {
        // ...
    }
}

module.exports = Discovery