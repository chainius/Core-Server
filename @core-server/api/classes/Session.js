const ApiEnvironment = plugins.require('api/ApiEnvironment');
const HttpServer = plugins.require('http/HttpServer');

/** session */
class Session
{
    /**
    * @param siteManager {Class}
    * @param token {String}
    */
    constructor(siteManager, token, options) {
        this.expirationTime = Date.now() + (24 * 60 * 60 * 1000);
        this.siteManager    = siteManager;
        this.token          = token;
        this.activeSockets  = [];
        this.cookies        = {};
        this.data           = {};
        this.ready          = true;

        if(typeof(options) === 'object')
            Object.assign(this, options)
    }

    onReady() {
        this.ready = true;
        return true;
    }

    executeOnReady(fn) { //Async fn as input
        if(this.ready)
            return fn();
        
        const onR = this.onReady();
        
        if(!onR.then)
            return fn();
        
        return new Promise((resolve, reject) => {
            onR.then(function() {
                fn().then(function(result) {
                    resolve(result);
                }).catch(function(err) {
                    reject(err);
                });
            }).catch(function(err) {
                reject(err);
            });
        })
    }

    updateCookies(cookies) {
        if (typeof (cookies) === 'object')
            this.cookies = cookies;
    }

    setData(data) {
        if(Object.keys(data).length === 0 || data === null) {
            this.data = {};
            return;
        }

        for (var key in data)
        {
            if(data[key] === undefined && this.data[key])
                delete this.data[key];
            else if(data[key] !== undefined)
                this.data[key] = data[key];
        }
    }

    //------------------------------------------

    /**
     * Broadcast a message to all the connected sockets
     * @param message (String)
     */
    broadcastSocketMessage(message) {
        for (var key in this.activeSockets)
            this.sendSocketMessage(this.activeSockets[key], message);
    }

    /**
     * Send a message to a specific socket
     * @param message (String|Object|Array)
     */
    sendSocketMessage(socket, message)
    {
        try
        {
            if (typeof (message) === 'object' || typeof (message) === 'array')
                message = JSON.stringify(message);

            socket.write(message);
        }
        catch (e)
        {
            console.error(e);
        }
    }

    handleSocketClose(socket) {
        try
        {
            const index = this.activeSockets.indexOf(socket);

            if (index !== -1)
                this.activeSockets.splice(index, 1);
        }
        catch (e)
        {
            console.error(e);
        }
    }

    handleSocket(socket) {
        this.activeSockets.push(socket);
        const _this = this;

        socket.on('data', function(message) {
            try {
                if(typeof(message) !== 'object') {
                    message = JSON.parse(message);
                }

                _this.handleSocketMessage(socket, message);
            }
            catch(e) {
                console.error(e);
                
                if(typeof(e) == 'string') {
                    _this.sendSocketMessage(socket, { error: e });
                } else if(typeof(e) == 'object' && e.message) {
                    _this.sendSocketMessage(socket, { error: e.message });
                } else if(typeof(e) == 'object' && e.error) {
                    _this.sendSocketMessage(socket, e);
                } else {
                    _this.sendSocketMessage(socket, { error: e });
                }
            }
        });

        socket.on('close', function() {
            _this.handleSocketClose(socket);
        });
    }

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
                getClientIp() { return client_ip },
                file,
                get,
                headers: socket ? socket.headers : {}
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

        return this.executeOnReady(() => this.__execApi(apiHandler, environment));
    }

    __execApi(apiHandler, environment) {
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
                        //err = { error: 'an internal error occured' };
                    }
                }
            }
            else if (typeof (err) === 'string') {
                err = { error: err };
            }

            throw(err);
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

    handleSocketApi(socket, api, post, salt) {
        const _this = this;
        var get     = {};

        if(api.indexOf('?') !== -1) {
            const querystring = require('querystring');
            get = querystring.parse(api.substr(api.indexOf('?')+1));
            api = api.substr(0, api.indexOf('?'));
        }
        
        this.executeOnReady(() => {
            const permission = this.siteManager.checkPermission(this, api, post, socket);
            if (permission !== true)
            {
                return new Promise(function(resolve, reject) {
                    reject(permission);
                });
            }

            return this.api(api, post, HttpServer.getClientIpFromHeaders(socket, socket), {}, get, socket);
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

    handleSocketMessage(socket, message) {
        if (message.event) {
            if (message.event === 'logout')
                this.data = {};
        }

        if (message.api)
            this.handleSocketApi(socket, message.api, message.data, message.salt);
    }

}

module.exports = Session;