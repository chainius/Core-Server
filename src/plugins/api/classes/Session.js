const ApiEnvironment = plugins.require('api/ApiEnvironment');

function cachedProperty(object, name, calculator) {
    var value = null;

    Object.defineProperty(object, name, {
        get: function() {
            if(value !== null)
                return value;

            value = calculator(object);
            return value;
        },

        set: function(nValue) {
            value = nValue;
        }
    });
}

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
    api(name, post, client_ip, file, get, socket) {

        var req = client_ip;
        if(typeof(client_ip) !== 'object')
        {
            req = {
                getClientIp() { return client_ip },
                file,
                get
            };
        }

        const apiHandler = this.siteManager.autoCreateApi(name);

        if (!apiHandler)
            return new Promise(function(resolve, reject) {
                reject({
                    error: 'The requested api could not be found.',
                    api: name
                })
            });

        const environment = this.createApiEnvironment(name, post, req);
        environment.socket = socket;

        return this.executeOnReady(function() {

            return apiHandler.handler.call(environment, apiHandler.console, apiHandler.path, apiHandler.dirname).then(function(result) {
                if ((typeof (result) === 'object' || typeof (result) === 'array') && result !== null)
                {
                    if (result['error'])
                        throw(result);

                    return result;
                }
                else {
                    return { result: result };
                }
            }).catch(function(err) {
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
                            //console.error(err);
                            //err = { error: 'an internal error occured' };
                        }
                    }
                }
                else if (typeof (err) === 'string') {
                    err = { error: err };
                }

                throw(err);
            });
        });
    }
    
    createApiEnvironment(name, post, req) {
        return new ApiEnvironment({
            siteManager:    this.siteManager,
            name:           name,
            session:        this.data,
            sessionObject:  this,
            cookie:         this.cookies,
            post:           post || {},
            $req:           req || {}
        });
    }

    handleSocketApi(socket, api, post, salt)
    {
        const _this = this;
        
        this.executeOnReady(() => {
            const permission = this.siteManager.checkPermission(this, api, post);
            if (permission !== true)
            {
                return new Promise(function(resolve, reject) {
                    reject(permission);
                });
            }

            return this.api(api, post, socket.remoteAddress, {}, {}, socket);
        }).then(function(result)
        {
            _this.sendSocketMessage(socket, {
                api: api,
                data: result,
                salt: salt
            });
        }).catch(function(err) {
            _this.sendSocketMessage(socket, {
                apiError: api,
                error: err,
                salt: salt
            });
        })
    }

    handleSocketMessage(socket, message) {
        super.handleSocketMessage(socket, message);

        if (message.api)
            this.handleSocketApi(socket, message.api, message.data, message.salt);
    }

}

module.exports = Session;