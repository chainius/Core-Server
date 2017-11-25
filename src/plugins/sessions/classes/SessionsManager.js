const Session   = plugins.require('sessions/Session');
const uniqid    = require('uniqid');

if (!Date.now)
{
    Date.now = function()
    {
        return new Date().getTime();
    };
}

class SessionsManager
{
    constructor(siteManager)
    {
        this.siteManager = siteManager;
        this.sessions = {};

        var _this = this;
        this.interval = setInterval(function()
        {
            _this.checkExpiredSessions();
        }, 5000);

        this.interval.unref();
    }

    getFromCookies(cookies)
    {
        if (typeof (cookies) !== 'object')
            return {};

        if (typeof (cookies.token) !== 'string' || cookies.token.length < 5 || cookies.token === '__global__') {
            cookies.token = uniqid();
            return this.getFromToken(cookies.token, true);
        }

        return this.getFromToken(cookies.token);
    }

    getFromToken(token, isNewToken)
    {
        try
        {
            if (this.sessions[token] === undefined) {
                this.sessions[token] = new Session(this.siteManager, token);
                
                if(!isNewToken) {
                    this.sessions[token].ready = false;
                }
            }

            return this.sessions[token];
        }
        catch (e)
        {
            console.error(e);
        }

        return null;
    }

    //-----------------------------------------------------

    checkExpiredSessions()
    {
        try
        {
            for (var token in this.sessions)
            {
                if (this.sessions[token].expirationTime <= Date.now())
                    delete this.sessions[token];
            }
        }
        catch (e)
        {
            console.error(e);
        }
    }

    //-----------------------------------------------------
    //Session socket

    handleSocket(socket)
    {
        try
        {
            var index = socket.url.lastIndexOf('?token=');
            if (index > 0)
            {
                var token = socket.url.substr(index + 7);
                index = token.indexOf('&');

                if (index != -1)
                    token = token.substr(0, index);

                if (token.length < 5 || token === '__global__')
                {
                    token = uniqid();
                    socket.write(JSON.stringify({cookies: {token: token}}));
                    socket.close();
                    return;
                }

                this.getFromToken(token).handleSocket(socket);
            }
        }
        catch (e)
        {
            console.error(e);
        }
    }

    broadcast(message, user_id)
    {
        var filterUsers = (typeof (user_id) === 'array' || typeof (user_id) === 'object');

        try
        {
            for (var key in this.sessions)
            {
                if (filterUsers)
                {
                    if (user_id.indexOf(this.sessions[key].data['auth_id']) !== -1)
                        this.sessions[key].broadcastSocketMessage(message);
                }
                else

                    this.sessions[key].broadcastSocketMessage(message);
            }
        }
        catch (e)
        {
            console.error(e);
        }
    }
}

module.exports = SessionsManager;