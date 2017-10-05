'use strict';
const cluster = require('cluster');

if(!cluster.isMaster) {
    module.exports = SuperClass;
    return;
}

class MasterServer extends SuperClass
{
    startWorker() {
        const worker = super.startWorker();

        if(this.setupNetworkDiscovery())
            this.networkDiscovery.registerWorker(worker);

        return worker;
    }

    getConfig(name, retry) {
        try {
            const Path = require('path');
            return require(Path.join(process.cwd(), 'config', 'servers.json'));
        } catch(e) {
            return {}
        }
    }

    setupNetworkDiscovery() {
        if(this.networkDiscovery)
            return true;

        const config = this.getConfig('servers');

        if(config['network-discover']) {
            const NetworkDiscovery = plugins.require('network-tasks/NetworkDiscovery');
            this.networkDiscovery  = NetworkDiscovery.Create(config['network-discover']);
            return true;
        }

        return false;
    }
}

module.exports = MasterServer;