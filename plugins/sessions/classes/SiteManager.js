const SessionsManager = plugins.require('sessions/SessionsManager');

class SiteManager extends SuperClass {

    constructor(HttpServer) {
        super(HttpServer);

        this.sessionsManager    = new SessionsManager(this);
    }

    /**
    * Get a session object from the given token
    * @param token {String}
    */
    getSession(token)
    {
        return this.sessionsManager.getFromToken(token);
    }

}

module.exports = SiteManager;