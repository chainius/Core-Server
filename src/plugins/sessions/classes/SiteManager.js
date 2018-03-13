const SessionsManager = plugins.require('sessions/SessionsManager');

class SiteManager extends SuperClass {

    constructor(HttpServer) {
        super(HttpServer);

        this.sessionsManager    = new SessionsManager(this);
        this.broadcastListeners = {};
    }

    /**
    * Get a session object from the given token
    * @param token {String}
    */
    getSession(token)
    {
        return this.sessionsManager.getFromToken(token);
    }

    /**
    * Broadcast a message to all users
    * @param api {String}
    * @param data {Object}
    * @param Selector Optional mongodb style {Object}
    */
    broadcast(api, data, selector) {
        return this.broadcastInternal(api, data, selector);
    }
    
    onBroadcast(channel, cb) {
        this.broadcastListeners[channel] = this.broadcastListeners[channel] || [];
        this.broadcastListeners[channel].push(cb);
    }

    /**
    * Broadcast a message to all users that are connected to this node
    * @param api {String}
    * @param data {Object}
    * @param Selector Optional mongodb style {Object}
    */
    broadcastInternal(api, data, salt, selector) {
        if(typeof(salt) === 'object')
        {
            selector = salt;
            salt = undefined;
        }
        
        if(this.broadcastListeners[api]) {
            this.broadcastListeners[api].forEach((cb) => {
                try {
                    cb(data, selector);
                } catch(e) {
                    console.error(e);
                }
            });
            return true;
        }

        return this.sessionsManager.broadcast({
            api: api,
            data: data || {},
            salt: salt || this.getSalt(api, {})
        }, selector);
    }

}

module.exports = SiteManager;