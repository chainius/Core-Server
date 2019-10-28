class SiteManager extends SuperClass {

    constructor(server) {
        super(server);

        const NetworkDiscovery = plugins.require('network-tasks/NetworkDiscovery');
        this.networkDiscovery  = NetworkDiscovery.Create();
        this.isMaster          = false;
        
        this.updateMasterStatus();
    }

    //--------------------------
    
    autoSetupFromConfig()
    {
        super.autoSetupFromConfig();
        const config = this.getConfig('servers');

        if (config.tasks) {
            process.nextTick(() => {
                for(var key in config.tasks)
                    this.registerTaskApi(key, config.tasks[key]);
            });
        }
    }

    onTask(name, cb) {
        return this.networkDiscovery.onTask(name, cb.bind(this));
    }

    registerTaskApi(name, api) {
        this.onTask(name, function(params) {
            const session = this.sessionsManager.getFromToken('__global__');
            return session.api(api, params, '*', {}, {});
        });
    }

    sendTask(name, params) {
        return this.networkDiscovery.distributeTask(name, params);
    }
    
    networkBroadcast(event, data) {
        return this.networkDiscovery.networkBroadcast(event, data);
    }

    onNetworkBroadcast(event, fn) {
        this.networkDiscovery.onBroadcast.push({
            event: event,
            fn:    fn.bind(this)
        })
    }
    
    onceNetworkBroadcast(event, fn) {
        this.networkDiscovery.broadcastEvent.once(event, fn.bind(this));
    }

    //--------------------------

    updateMasterStatus() {
        const _this = this;
        if(!this.networkDiscovery)
            return;

        this.networkDiscovery.isMaster().then(function(res) {
            _this.onMasterStateChanged(res);
            
            setTimeout(() => {
                _this.updateMasterStatus();
            }, 5000);
        }).catch(function(err) {
            console.error(err);
        })
    }

    onMasterStateChanged(isMaster) {
        if(this.isMaster !== isMaster) {
            if(isMaster)
                console.log('Node becomes the new master');
            else
                console.log('Master downgraded to slave status');
        }

        this.isMaster = isMaster;
    }
}

module.exports = SiteManager;