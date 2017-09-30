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
            console.error('{setupRedis}', e);
        }
    }


    /**
    * Broadcast a message over a channel using the redis service
    * @param channel {String}
    * @param msg {String|Object}
    */
    broadcastToRedis(channel, msg)
    {
        this.connections = this.connections || {};

        try
        {
            if(!this.connections.redis)
            {
                console.warn('Cannot broadcast redis event, redis server not instantiated');
                return;
            }

            this.connections.redis.emit(channel, msg);
        }
        catch(e)
        {
            console.error('{broadcastToRedis}', e);
        }
    }

    /**
    * Listen to a redis broadcast channel
    * @param channel {String}
    * @param callback {Function}
    */
    onRedisBroadcast(channel, cb)
    {
        this.connections = this.connections || {};

        if (!this.connections.redis)
            return console.error('Please instantiate a redis server before listening some broadcast events');

        this.connections.redis.onChannel(channel, cb);
    }

}

module.exports = SiteManager;