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

    onReady()
    {
        if (this.redisLoaded)
            return super.onReady();

        const superOnReady = super.onReady;

        const _this = this;
        return new Promise(function(resolve, reject)
        {
            var didTimeout = false;
            const timeout = setTimeout(function() {
                didTimeout = true;
                reject('The session could not be loaded');
            }, 1500);

            _this.onRedisLoaded.push(function()
            {
                const sresult = superOnReady();
                
                if(sresult.then) {
                    sresult.then(function(data) {
                        if(!didTimeout)
                            resolve(data);
                    }).catch(function(err) {
                        if(!didTimeout)
                            reject(err);
                    }).then(function() {
                        clearTimeout(timeout);
                    });
                }
                else {
                    if(!didTimeout)
                        resolve(data);
                    
                    clearTimeout(timeout);
                }
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
        const redis = this.siteManager.connections.redis;
        if (!redis || this.token === 'global')
            return;

        var _this = this;
        redis.getExpirationTime('session_' + this.token, -2).then(function(data)
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
        const redis = this.siteManager.connections.redis;

        const _this = this;
        function dispatchLoaded()
        {
            _this.redisLoaded = true;

            for (var key in _this.onRedisLoaded)
            {
                try
                {
                    _this.onRedisLoaded[key].call(_this, redis);
                }
                catch (e)
                {
                    console.error(e);
                }
            }
        }

        if (redis && this.token !== 'global')
        {
            redis.load('session_' + this.token).then(function(data)
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
        const redis = this.siteManager.connections.redis;

        if (redis && this.token !== 'global')
            redis.save('session_' + this.token, this.data, this.expirationTime);

        this.emitRedis();
    }

    /**
    * Emit the session to the other servers in the cluster using redis
    */
    emitRedis()
    {
        const redis = this.siteManager.connections.redis;

        if (redis && this.token !== 'global')
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