'use strict';

const Path          = require('path');
const minimatch     = require("minimatch")
const ApiCreator    = plugins.require('api/ApiCreator');
const Watcher       = plugins.require('http/Watcher');
const Crypter       = plugins.require('http/Crypter');
const SessionsManager = plugins.require('api/SessionsManager');

const EventEmitter = require('events');//tmp
const iv           = Crypter.sha1(JSON.stringify(require(Path.join(process.cwd(), 'package.json')))).substr(0, 16);

class SiteManager extends SuperClass
{
    constructor(HttpServer)
    {
        super(HttpServer);

        this.apiCreator         = new ApiCreator(this);
        this.permissionsConfig  = null;

        this.sessionsManager    = new SessionsManager(this);
        this.broadcastListeners = {};

        /*process.nextTick(() => {
            this.stressTest();
        })*/
    }

    /**
    * Get the salt of a specified api
    * @param api {String}
    * @param post {Object}
    */
    getSalt(api, data) {
        var dataJ = JSON.stringify(data);
        if (dataJ.length == 0) return api;

        var char, hash = 0;

        for (var i = 0; i < dataJ.length; i++) {
            char = dataJ.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash;
        }

        return api + '_' + Math.abs(hash);
    }

    //------------------------------------------

    /**
    * Return the configuration for the requested api path
    * @param api_name {String}
    * @returns {Object} { config: { PULBLIC-API CONFIG }, api: api name }
    */
    getPermissionsConfig(api) {
        if(this.permissionsConfig !== null)
            return this.permissionsConfig;
        
        this.permissionsConfig = {
            config: null,
            globsConfig: null
        }

        const basePath = Path.join(process.cwd(), 'config', 'public-api');
        var configPath = basePath + '.json';
        const _this    = this;
        
        function load() {
            try
            {
                const fs          = require('fs');
                const content     = fs.readFileSync(configPath);
                const config      = JSON.parse(content);
                
                _this.permissionsConfig.config = config;
                _this.permissionsConfig.globsConfig = {};
                
                for(var key in config) {
                    if(config[key].filter) {
                        const res = config[key].filter(function(obj) { return obj.indexOf('*') !== -1 });

                        if(res.length > 0)
                            _this.permissionsConfig.globsConfig[key] = res;
                    }
                }
            }
            catch (e)
            {
                if(e.code !== 'ENOENT')
                    console.error('Error loading permissions config', e);
            }
            
            return _this.permissionsConfig;
        }

        if (process.env.NODE_ENV === 'production')
        {
            const prodPath = basePath + '-production.json';
            const fs       = require('fs');

            if (fs.existsSync(prodPath))
                return load()
        }
        else {
            Watcher.onFileChange(configPath, function() {
                console.warn('Permissions configuration changed');
                load();
            });
        }

        return load();
    }

    /**
    * @param session {Class}
    * @param role {String}
    */
    sessionHasRole(session, role) {
        return false;
    }

    /**
    * @param session {Class}
    * @param role {String}
    * @param api {String}
    * @param connected {Boolean}
    */
    roleDeniedMessage(session, role, api, connected, req)
    {
        if (!connected)
        {
            return {
                error:      'You need to be connected in order to call this api (' + api + ')',
                reconnect:  true,
                httpCode:   401
            };
        }

        return {
            error:          'Access denied to the requested api (' + api + ')',
            httpCode:       401
        };
    }

    /**
    * Check the permissions for a given api linked to a session object
    * @param session {Class} The session object
    * @param api {String}
    * @param post {Object}
    * @returns {Boolean} true if the credentials are accepted
    * @returns {Object} { error: message, httpCode: 500 }
    */
    checkPermission(session, api, post, req) {
        var config = this.getPermissionsConfig(api);

        if (config.api)
            api = config.api;

        const globsConfig = config.globsConfig || {};
        config = config.config;
        if (!config)
            return false;

        function checkConfig(field) {
            if (config[field] === undefined)
                return false;

            if(config[field].indexOf(api) !== -1)
                return true;

            if(!globsConfig[field])
                return false;

            const subGlob = globsConfig[field];
            for(var key in subGlob) {
                if(minimatch(api, subGlob[key])) {
                    config[field].push(api); //Does not require a match test next time, ToDo check if api exists before add to array
                    return true;
                }
            }

            return false;
        }

        if (checkConfig('everyone'))
            return true;

        const connected = !isNaN(parseInt(session.data['auth_id']));

        if (checkConfig('connected')) {
            if (connected)
                return true
            else
                return this.roleDeniedMessage(session, '*', api, false, req)
        }

        if (checkConfig('notconnected')) {
            if (!connected)
                return true;
            else {
                return {
                    error: "You're already connected, please logout before continue.",
                    httpCode: 401
                };
            }
        }

        for(var key in config) {
            if(checkConfig(key)) {
                if(!this.sessionHasRole(session, key)) {
                    const msg = this.roleDeniedMessage(session, key, api, connected, req);
                    if(msg !== false) {
                        return msg;
                    }
                }
                else {
                    return true;
                }
            }
        }

        return {
            error: 'The requested api could not be found',
            api: api
        };
    }

    /**
    * Add some additional vars to the query requests of an api
    * @param session {Class} The session object
    * @param api {String}
    * @param post {Object}
    * @param client_ip {String}
    * @returns {Object}
    */
    apiQueryVars(session, api, post, client_ip)
    {
        return {};
    }

    /**
    * Get the base directory for a given api
    * @param api_name {String}
    * @returns {String}
    */
    apiBasePath(name)
    {
        return Path.join(process.cwd(), 'api') + Path.sep;
    }

    /**
    * Get the full path for a given api
    * @param base_path {String}
    * @param api_name {String}
    * @returns {String}
    */
    apiPath(base, name)
    {
        return base + name;
    }

    /**
    * This variables are globally accessible in every called api
    * @returns {Object}
    */
    getApiContext()
    {
        return {};
    }

    autoCreateApi(name)
    {
        if(this.apiCreator.apis[name])
            return this.apiCreator.apis[name];

        try
        {
            const base = this.apiBasePath(name);
            const path = this.apiPath(base, name);
            const code = this.apiCreator.create(path, name);

            if (code != false)
            {
                const _this = this;
                Watcher.onFileChange(code.path, function()
                {
                    console.warn('Api', name, 'changed');

                    try {
                        const nCode = _this.apiCreator.create(path, name);

                        if (nCode !== false)
                            _this.apiCreator.apis[name] = nCode;

                    } catch(e) {
                        console.error('{autoCreateApi-watch}', e);
                    }
                });

                this.apiCreator.apis[name] = code;
                return this.apiCreator.apis[name];
            }
        }
        catch (e)
        {
            console.error('{autoCreateApi}', e);
        }

        return null;
    }

    async apiWsJoin(post, req, tokenChangeNotify) {
        if(post.token && !req) {
            const token = JSON.parse(Crypter.decrypt(post.token, iv, iv));
            if(token.exp < Date.now())
                throw('Token expired');
            if(!token)
                throw('Wrong token provided')

            delete token.rand;
            return token;
        }

        const signature = Crypter.encrypt(JSON.stringify({
            rand:  Math.random(),
            ip:    req.getClientIp(),
            token: req.cookies.token,
            exp:   Date.now() + (30 * 1000) //30 seconds lifetime
        }), iv, iv);

        return {
            token:   signature,
            session: Crypter.sha1Hex(req.cookies.token).substr(0, 16),
            exp:     this.getSession(req.cookies.token).expirationTime,
        }
    }

    /**
    * Call an api from an http request
    * @async
    * @param api_name {String}
    * @param post {Object}
    * @param req {Object}
    * @param token_changed_cb {Function}
    * @return {Promise<Object>} The reponse object of the api.
    */
    api(name, post, req, tokenChangeNotify) {
        const cookies = req.cookies
        const oToken  = cookies.token;
        const session = this.sessionsManager.getFromCookies(cookies);

        session.updateCookies(cookies);

        if (session.token !== oToken && tokenChangeNotify)
            tokenChangeNotify(session.token, session.expirationTime, oToken);

        return session.executeOnReady(() => {
            if(name === 'ws_join')
                return this.apiWsJoin(post, req, tokenChangeNotify);

            const permission = this.checkPermission(session, name, post, req);
            if (permission === false)
                throw({
                    error: 'The requested api could not been found',
                    httpCode: 404
                });
            if (permission !== true)
                throw(permission);

            return session.api(name, post, req);
        });
    }


    //------------------------------------------

    /**
    * Handle an api for an http request
    * @param req {Object}
    * @param res {Object}
    */
    handleApi(req, res, offset) {
        const _this = this;

        if (offset === undefined)
            offset = 0;

        function handleResult(result, code)
        {
            if(req.timedout)
                return console.error('{handleApi-Result}', path, 'Response received after timeout');

            try
            {
                for(var name in req.responseHeaders || []) {
                    res.setHeader(name, req.responseHeaders[name])
                }

                res.writeHead(code || 200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify(result));
            }
            catch (e)
            {
                console.error('{handleApi-Result}', e);
                _this.sendErrorPage(500, req, res);
            }
        }

        function handleCatch(err) {
            if(!err)
                err = { error: 'Empty error' };

            var httpCode = err.httpCode || 400;
            if(err.httpCode)
                delete err.httpCode;

            if (typeof (err) === 'object' || typeof (err) === 'array')
            {
                if (err.error !== undefined)
                {
                    return handleResult(err, httpCode);
                }
                else if (err.message !== undefined)
                {
                    console.error('{handleApi}', err);
                    return handleResult({ error: err.message }, httpCode);
                }
            }
            else if (typeof (err) === 'string')
            {
                return handleResult({ error: err }, httpCode);
            }

            _this.sendErrorPage(httpCode, req, res);
        }

        /*return handleResult({
            test: 'abc'
        })*/

        //------------------------------------------

        var path = req.url.substr(1 + offset);
        if(path.indexOf('?') !== -1)
        {
            this.server.createCachedProperty(req, 'get', function() {
                const querystring = require('querystring');
                return querystring.parse(req.url.substr(req.url.indexOf("?")+1));
            });

            path = path.substr(0, path.indexOf('?') );
        }
        else {
            req.get = req.get || {};
        }

        //------------------------------------------
        
        try {
            const config = this.getConfig('servers')

            return this.api(path, req.body, req, (token, expiration, otoken) => {
                const d = new Date();
                d.setTime(expiration);
                const expires = 'expires=' + d.toUTCString() + ';';

                var cookie = 'token=' + token + ';' + expires + 'path='+(config.apiPath || '/api')+';HttpOnly;SameSite=Strict';
                if(process.options.production !== undefined && process.options['disable-secure-cookie'] === undefined) {
                    if(typeof(this.setCookieSecure) !== 'function' || this.setCookieSecure(req, path))
                        cookie += ';Secure'
                }

                res.setHeader('Set-Cookie', cookie);
            }).then(handleResult).catch(handleCatch);

        } catch(e) {
            handleCatch(e);
        }
    }

    createTestCase(cb) {
        const start = process.hrtime();
        const event = new EventEmitter();
        
        const req = {
            url: '/api/test/test',
            headers: { 
                'cache-control': 'no-cache',
                'content-type': 'application/x-www-form-urlencoded',
                'user-agent': 'PostmanRuntime/6.3.2',
                accept: '*/*',
                host: 'localhost:8082',
                cookie: 'token=',
                'accept-encoding': 'gzip, deflate',
                'content-length': '39',
                connection: 'keep-alive' 
            },
            
            on(e, cb) {
                if(e === 'data') {
                    process.nextTick(() => {
                        cb('username=skyhark-live&password=semimoon');
                        event.emit('end');
                    });
                } else {
                    event.on(e, cb);
                }
            },
            
            removeListener(e, cb) {
                event.removeListener(e, cb);
            }
        }
        
        const res = {
            write() {
                
            },
            
            writeHead() {
                this._headerSent = true;
            },
            
            setHeader() {
                this._headerSent = true;
            },
            
            end() {
                event.emit('close');
                const diff = process.hrtime(start);
                cb(diff[0] * 1e9 + diff[1]);
            }
        };

        this.server.handleRequest(req, res);
    }

    stressTest() {
        const start     = Date.now();
        const durations = [];
        const _this     = this;
        var rpm = 0;
        
        console.log('Start test');
        console.time("test-api");
        
        function next() {
            _this.createTestCase((duration) => {
                durations.push(duration);
                rpm++;

                if(Date.now() - start < 1000) {
                    return process.nextTick(next);
                }

                const avg = durations.reduce(function(a, b) { return a + b }) / durations.length;
                console.success("Total time:", Date.now() - start);
                console.success('RPM:', rpm)
                console.success("AVG Time:", avg, "\n");
                console.timeEnd("test-api");
            })
        }

        next();
    }

    preHandle(req, res, prePath)
    {
        if(prePath !== 'api')
            return super.preHandle(req, res, prePath);

        /*process.nextTick(() => {
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({
                test: 'abc'
            }));
        });

        return true;*/

        this.server.parseBody(req, res, () => {
            //console.log(req.cookies)
            this.handleApi(req, res, 4);
            /*res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({
                test: 'abc'
            }));*/
        });

        return true;
    }

    //------------------------------------------

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
                try {
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
            salt: salt //|| this.getSalt(api, {})
        }, selector);
    }
}

module.exports = SiteManager;