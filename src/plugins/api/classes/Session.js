const ApiEnvironment = plugins.require('api/ApiEnvironment');

/** session */
class Session extends SuperClass
{
    /**
    * Call an api for this session
    * @param name {String}
    * @param post {Object}
    * @param client_ip {String}
    * @param files {Object} optional
    */
    async api(name, post, client_ip, file, get) {
        const _this       = this;

        this.siteManager.autoCreateApi(name);

        const apiHandler = this.siteManager.apiCreator.apis[name];
        if (!apiHandler)
            throw({ error: 'The requested api could not be found.', api: name });

        await this.onReady();

        const environment = new ApiEnvironment({
            siteManager:    this.siteManager,
            name:           name,
            session:        this.data,
            sessionObject:  this,
            cookie:         this.cookies,
            post:           post || {},
            $get:           get || {},
            file:           file || {},
            client_ip:      client_ip,
            queryVars:      this.siteManager.apiQueryVars(this, name, post, client_ip, file, get),

            setSessionData: function(data)
            {
                _this.setData(data);
                environment.session = _this.data;
            },

            setCookieData: function(data)
            {
                try
                {
                    for (var key in data)
                    {
                        _this.cookies[key] = data[key];
                        environment.cookie[key] = data[key];
                    }
                }
                catch (e)
                {
                    console.error(e);
                }

                if (Date.now() + 48 * 60 * 600000 > _this.expirationTime)
                    _this.broadcastSocketMessage({cookies: data});
                else
                    _this.broadcastSocketMessage({cookies: data, expiration: _this.expirationTime});
            },

            setSessionExpiration: function(time)
            {
                _this.expirationTime = Date.now() + (time * 1000);
            }
        });

        try {
            const result = await apiHandler.call(environment, post, client_ip, file, get);

            if ((typeof (result) === 'object' || typeof (result) === 'array') && result !== null)
            {
                if (result['error'])
                    throw(result);

                return result;
            }
            else
                return { result: result };
        }
        catch(err) {
            if (typeof (err) === 'object' || typeof (err) === 'array')
            {
                if (err.error === undefined)
                {
                    if (err.message != undefined)
                    {
                        if(err.showIntercept !== false)
                            console.error(err);

                        err = { error: err.message };
                    }
                    else
                    {
                        console.error(err);
                        err = { error: 'an internal error occured' };
                    }
                }
            }
            else if (typeof (err) === 'string') {
                err = { error: err };
            }

            throw(err);
        }
    }

    handleSocketApi(socket, api, post, salt)
    {
        const permission = this.siteManager.checkPermission(this, api, post);
        const _this = this;

        if (permission !== true)
        {
            return _this.sendSocketMessage(socket, {
                apiError: api,
                error: permission,
                salt: salt
            });
        }

        this.api(api, post, socket.remoteAddress).then(function(result)
        {
            _this.sendSocketMessage(socket, {
                api: api,
                data: result,
                salt: salt
            });
        })
        .catch(function(err)
        {
            _this.sendSocketMessage(socket, {
                apiError: api,
                error: err,
                salt: salt
            });
        });
    }

    handleSocketMessage(socket, message) {
        super.handleSocketMessage(socket, message);

        if (message.api)
            this.handleSocketApi(socket, message.api, message.data, message.salt);
    }

}

module.exports = Session;