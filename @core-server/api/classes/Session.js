const ApiEnvironment = plugins.require('api/ApiEnvironment')
const HttpServer = plugins.require('http/HttpServer')

/** session */
class Session {
    /**
    * @param siteManager {Class}
    * @param token {String}
    */
    constructor(siteManager, token, options) {
        this.expirationTime = Date.now() + (24 * 60 * 60 * 1000)
        this.siteManager = siteManager
        this.token = token
        this.activeSockets = []
        this.cookies = {}
        this.data = {}
        this.ready = true

        if(typeof(options) === 'object')
            Object.assign(this, options)
    }

    onReady() {
        this.ready = true
        return true
    }

    executeOnReady(fn, info = null) { // Async fn as input
        if(this.ready)
            return fn()

        return (new Promise((resolve, reject) => {
            try {
                resolve(this.onReady())
            } catch(e) {
                reject(e)
            }
        })).catch((e) => {
            if(typeof(e) == 'string')
                e = new Error(e)

            e.httpCode = 504
            this.onException(e, info)
            throw(e)
        }).then(fn)
    }

    static toRequest({ client_ip, file, get, socket }) {
        if(!client_ip && socket) {
            client_ip = function() {
                return HttpServer.getClientIpFromHeaders(socket, socket)
            }    
        }

        return {
            getClientIp: typeof(client_ip) == 'function' ? client_ip : () => client_ip,
            headers:     socket ? socket.headers : {},
            file:        file || {},
            get:         get || {},
            socket,
        }
    }

    updateCookies(cookies) {
        if (typeof (cookies) === 'object')
            this.cookies = cookies
    }

    setData(data) {
        if(Object.keys(data).length === 0 || data === null) {
            this.data = {}
            return
        }

        for (var key in data) {
            if(data[key] === undefined && this.data[key])
                delete this.data[key]
            else if(data[key] !== undefined)
                this.data[key] = data[key]
        }
    }

    //------------------------------------------

    /**
     * Broadcast a message to all the connected sockets
     * @param message (String)
     */
    broadcastSocketMessage(message) {
        for (var key in this.activeSockets)
            this.sendSocketMessage(this.activeSockets[key], message)
    }

    /**
     * Send a message to a specific socket
     * @param message (String|Object|Array)
     */
    sendSocketMessage(socket, message) {
        try {
            if (typeof (message) === 'object')
                message = JSON.stringify(message)

            socket.write(message)
        } catch (e) {
            console.error(e)
        }
    }

    handleSocketClose(socket) {
        try {
            const index = this.activeSockets.indexOf(socket)

            if (index !== -1)
                this.activeSockets.splice(index, 1)
        } catch (e) {
            console.error(e)
        }
    }

    handleSocket(socket) {
        this.activeSockets.push(socket)

        socket.on('data', (message) => {
            try {
                if(typeof(message) !== 'object')
                    message = JSON.parse(message)

                this.handleSocketMessage(socket, message)
            } catch(e) {
                console.error(e)
                
                if(typeof(e) == 'string') {
                    this.sendSocketMessage(socket, { error: e, httpCode: 500 })
                } else if(typeof(e) == 'object' && e.message) {
                    if(e.stack && this.onException) {
                        e.httpCode = e.httpCode || 500
                        this.onException(e, message)
                    }

                    this.sendSocketMessage(socket, { error: e.message, httpCode: e.httpCode || 500 })
                } else if(typeof(e) == 'object' && e.error) {
                    this.sendSocketMessage(socket, e)
                } else {
                    this.sendSocketMessage(socket, { error: e, httpCode: 500 })
                }
            }
        })

        socket.on('close', () => {
            this.handleSocketClose(socket)
        })
    }

    /**
    * Call an api for this session
    * @param name {String}
    * @param post {Object}
    * @param client_ip {String}
    * @param files {Object} optional
    */
    api(name, post, req) {
        const apiHandler = this.siteManager.autoCreateApi(name)

        if (!apiHandler)
            return new Promise(function(resolve, reject) {
                reject({
                    error: 'The requested api could not be found.',
                    api:   name
                })
            })

        const environment = this.createApiEnvironment(name, post, req)
        environment.socket = req.socket

        return this.executeOnReady(() => this.__execApi(apiHandler, environment), apiHandler)
    }

    __execApi(apiHandler, environment) {
        return apiHandler.handler.call(environment, apiHandler.console, apiHandler.path, apiHandler.dirname).then(function(result) {
            if ((typeof (result) === 'object') && result !== null) {
                if (result['error'])
                    throw(result)

                return result
            } else {
                return { result: result }
            }
        }).catch((err) => {
            if (typeof (err) === 'object') {
                if (err.error === undefined) {
                    if (err.message != undefined) {
                        if(err.showIntercept !== false)
                            console.error(err)

                        if(err.stack && this.onException) {
                            this.onException(err, {
                                name: apiHandler.name,
                                environment,
                            })

                            err.httpCode = err.httpCode || 500
                        }

                        if(err.stack && err.stack.indexOf('sequelize') != -1)
                            err = { error: "internal error", httpCode: 500 }
                        else
                            err = { error: err.message }
                    } else {
                        // console.error(err);
                        // err = { error: 'an internal error occured' };
                    }
                }
            } else if (typeof (err) === 'string') {
                err = { error: err }
            }

            throw(err)
        })
    }

    createApiEnvironment(name, post, req) {
        return new ApiEnvironment({
            siteManager:   this.siteManager,
            name:          name,
            session:       this.data,
            sessionObject: this,
            cookie:        this.cookies,
            post:          post || {},
            $req:          req || {}
        })
    }

    handleSocketApi(socket, api, post, salt) {
        var get = {}

        if(api.indexOf('?') !== -1) {
            const querystring = require('querystring')
            get = querystring.parse(api.substr(api.indexOf('?')+1))
            api = api.substr(0, api.indexOf('?'))
        }
        
        this.executeOnReady(() => {
            const permission = this.siteManager.checkPermission(this, api, post, socket)
            if (permission !== true) {
                return new Promise(function(resolve, reject) {
                    reject(permission)
                })
            }

            return this.api(api, post, Session.toRequest({
                client_ip() {
                    return HttpServer.getClientIpFromHeaders(socket, socket)
                },
                file: {},
                get,
                socket,
            }))
        }, { name: api }).then((result) => {
            this.sendSocketMessage(socket, {
                api:  api,
                data: result,
                salt: salt
            })
        }).catch((err) => {
            this.sendSocketMessage(socket, {
                apiError: api,
                error:    err,
                salt:     salt
            })
        })
    }

    handleSocketMessage(socket, message) {
        if (message.event) {
            if (message.event === 'logout')
                this.data = {}
        }

        if (message.api)
            this.handleSocketApi(socket, message.api, message.data, message.salt)
    }

}

module.exports = Session