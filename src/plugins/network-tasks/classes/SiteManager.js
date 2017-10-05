class SiteManager extends SuperClass {

    constructor(server) {
        super(server);

        const NetworkDiscovery = plugins.require('network-tasks/NetworkDiscovery');
        this.networkDiscovery = NetworkDiscovery.Create();
    }

    //--------------------------

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

    //--------------------------

}

module.exports = SiteManager;