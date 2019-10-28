/** session */
class Session extends SuperClass
{
    /**
    * @param siteManager {Class}
    * @param token {String}
    */
    constructor(siteManager, token, options)
    {
        super(siteManager, token, options);

        this.siteManager.connections = this.siteManager.connections || {};
        this.redisLoaded    = (!this.siteManager.connections.redis || token === '__global__' || this.localeOnly);
        this.ready          = this.ready && this.redisLoaded;
        this.onRedisLoaded  = [];
        this.updateTime     = 0;

        this.loadFromRedis();
    }

    onReady()
    {
        if (this.redisLoaded)
            return super.onReady();

        const superOnReady = super.onReady.bind(this);

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
                            resolve();
                    }).catch(function(err) {
                        if(!didTimeout)
                            reject(err);
                    }).then(function() {
                        clearTimeout(timeout);
                    });
                }
                else {
                    if(!didTimeout)
                        resolve();
                    
                    clearTimeout(timeout);
                }
            });
        });
    }

    setData(data) {
        super.setData(data);
        this.saveToRedis();
    }

    //Session will not been shared between multiple nodes
    setLocalOnly() {
        this.localeOnly = true;
        this.redisLoaded = true;
    }

    //------------------------------------------

    loadRedisTTL()
    {
        const redis = this.siteManager.connections.redis;
        if (!redis || this.token === '__global__' || this.localeOnly)
            return;

        var _this = this;
        redis.getExpirationTime(this.token, -2).then(function(data)
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

        if (redis && this.token !== '__global__' && !this.localeOnly) {
            console.log('loading session from redis server')
            redis.load(this.token).then(function(data) {
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
        } else {
            dispatchLoaded();
        }
    }

    /**
    * Save the session from the global redis service
    */
    saveToRedis()
    {
        this.updateTime = Date.now();
        const redis = this.siteManager.connections.redis;

        if (redis && this.token !== '__global__' && !this.localeOnly)
            redis.save(this.token, this.data, this.expirationTime);

        this.emitRedis();
    }

    /**
    * Emit the session to the other servers in the cluster using redis
    */
    emitRedis()
    {
        const redis = this.siteManager.connections.redis;

        if (redis && this.token !== '__global__' && !this.localeOnly)
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