'use strict';

class SiteManager extends SuperClass
{
    autoSetupFromConfig()
    {
        super.autoSetupFromConfig();
        const config = this.getConfig('servers');

        if (config.redis) {
            const _this = this;
            process.nextTick(function() {
                _this.setupRedis(config.redis);
            });
        }
    }

    /**
    * Setup a redis connection that will be used by the api's
    * @param config {Object}
    */
    setupRedis(config)
    {
        this.connections = this.connections || {};

        try
        {
            if (config === undefined)
                config = this.getConfig('servers').redis;

            const Redis = plugins.require('redis/Redis');

            this.connections.redis = new Redis(config);
            this.sessionsManager.setupRedis();
        }
        catch (e)
        {
            console.error(e);
        }
    }

}

module.exports = SiteManager;