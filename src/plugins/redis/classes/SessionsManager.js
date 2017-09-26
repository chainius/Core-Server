class SessionsManager extends SuperClass
{
    setupRedis()
    {
        var _this = this;
        this.siteManager.onBroadcast('SESSION_UPDATE', function(msg)
        {
            if (msg.token && msg.data)
                _this.sessionUpdateFromRedis(msg.token, msg.data, msg.time);
        });
    }

    sessionUpdateFromRedis(token, data, time)
    {
        try
        {
            if (typeof (data) !== 'object')
                console.error('Wrong session data type received from redis (' + typeof (data) + ')');
            else if (typeof (token) !== 'string')
                console.error('Wrong session token type received from redis (' + typeof (token) + ')');
            else
            {
                if (this.sessions[token])
                {
                    if (this.sessions[token].updateTime < time)
                        this.sessions[token].data = data;
                }

                if (!isNaN(parseInt(data.auth_id)))
                {
                    const auth_id = parseInt(data.auth_id);

                    for (var tokenX in this.sessions)
                    {
                        if (tokenX === token)
                            continue;

                        try
                        {
                            if (parseInt(this.sessions[tokenX].data.auth_id) === auth_id)
                            {
                                if (this.sessions[tokenX].updateTime < time)
                                    this.sessions[tokenX].data = data;
                            }
                        }
                        catch (e)
                        {
                            _console.error(e);
                        }
                    }
                }
            }
        }
        catch (e)
        {
            console.error(e);
        }
    }
}

module.exports = SessionsManager;