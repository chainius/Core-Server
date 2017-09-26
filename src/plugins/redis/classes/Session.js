/** session */
class Session extends SuperClass
{
    /**
    * @param siteManager {Class}
    * @param token {String}
    */
    constructor(siteManager, token)
    {
        super(siteManager, token);

        this.siteManager.connections = this.siteManager.connections || {};
        this.redisLoaded    = (!this.siteManager.connections.redis || token === 'global');
        this.onRedisLoaded  = [];

        this.loadFromRedis();
    }

    onReady(cb)
    {
        if (this.redisLoaded)
            return super.onReady(cb);

        const superOnReady = super.onReady;

        const _this = this;
        return new Promise(function(resolve, reject)
        {
            _this.onRedisLoaded.push(function()
            {
                superOnReady(cb).then(function(data) {
                    resolve(data);
                }).catch(function(err) {
                    reject(err);
                });
            });
        });
    }

    setData(data) {
        super.setData(data);
        this.saveToRedis();
    }

    //------------------------------------------

    loadRedisTTL()
    {
        if (!this.siteManager.redis || this.token === 'global')
            return;

        var _this = this;
        this.siteManager.redis.getExpirationTime('session_' + this.token, -2).then(function(data)
        {
            if (data > Date.now())
                _this.expirationTime = data;
        })
        .catch(function(err)
        {
            console.error(err);
        });
    }

    /**
    * Load the session from the global redis service
    */
    loadFromRedis()
    {
        const _this = this;
        function dispatchLoaded()
        {
            _this.redisLoaded = true;

            for (var key in _this.onRedisLoaded)
            {
                try
                {
                    _this.onRedisLoaded[key].call(_this, _this.siteManager.redis);
                }
                catch (e)
                {
                    console.error(e);
                }
            }
        }

        if (this.siteManager.redis && this.token !== 'global')
        {
            this.siteManager.redis.load('session_' + this.token).then(function(data)
            {
                if (typeof (data) !== 'object')
                {
                    console.error('Wrong data loaded for session ' + this.token + ' from redis (' + typeof (data) + ')');
                }
                else
                {
                    _this.data = data;
                    _this.loadRedisTTL();
                }

                dispatchLoaded();
            })
            .catch(function(e)
            {
                dispatchLoaded();
            });
        }
    }

    /**
    * Save the session from the global redis service
    */
    saveToRedis()
    {
        this.updateTime = Date.now();

        if (this.siteManager.redis && this.token !== 'global')
            this.siteManager.redis.save('session_' + this.token, this.data, this.expirationTime);

        this.emitRedis();
    }

    /**
    * Emit the session to the other servers in the cluster using redis
    */
    emitRedis()
    {
        if (this.siteManager.redis && this.token !== 'global')
        {
            this.siteManager.broadcastToRedis('SESSION_UPDATE', {
                token: this.token,
                time: this.updateTime,
                data: this.data
            });
        }
    }

    handleSocketMessage(socket, message)
    {
        super.handleSocketMessage(socket, message);

        if (message.event)
        {
            if (message.event === 'logout')
            {
                this.saveToRedis();
            }
        }
    }
}

module.exports = Session;