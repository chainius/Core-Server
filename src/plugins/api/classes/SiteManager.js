'use strict';

const Path          = require('path');
const minimatch     = require("minimatch")
const ApiCreator    = plugins.require('api/ApiCreator');
const Watcher       = plugins.require('web-server/Watcher');

class SiteManager extends SuperClass
{
    constructor(HttpServer)
    {
        super(HttpServer);

        this.apiCreator = new ApiCreator(this);
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
    * @returns {Object} { config: { PULBLIC-API CONFIG }, api: api name }
    */
    getPermissionsConfig(api)
    {
        const config = this.getConfig('public-api');
        const globsConfig = {};

        for(var key in config) {
            if(config[key].filter) {
                const res = config[key].filter(function(obj) { return obj.indexOf('*') !== -1 });

                if(res.length > 0)
                    globsConfig[key] = res;
            }
        }

        return {
            config: config,
            globsConfig: globsConfig,
            api: api
        };
    }

    /**
    * @param session {Class}
    * @param role {String}
    */
    sessionHasRole(session, role)
    {
        return false;
    }

    /**
    * @param session {Class}
    * @param role {String}
    * @param api {String}
    * @param connected {Boolean}
    */
    roleDeniedMessage(session, role, api, connected)
    {
        if (!connected)
        {
            return {
                error: 'You need to be connected in order to call this api (' + api + ')',
                httpCode: 401
            };
        }

        return {
            error: 'Access denied to the requested api (' + api + ')',
            httpCode: 401
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
    checkPermission(session, api, post)
    {
        var config = this.getPermissionsConfig(api);

        if (config.api)
            api = config.api;

        const globsConfig = config.globsConfig || {};
        config = config.config;
        if (!config)
            return false;

        function checkConfig(field)
        {
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

        if (checkConfig('connected'))
        {
            if (connected)
                return true;
            else
                {
                return {
                    error: 'You need to be connected in order to call this api (' + api + ')',
                    httpCode: 401
                };
            }
        }

        if (checkConfig('notconnected'))
        {
            if (!connected)
                return true;
            else
                {
                return {
                    error: "You're already connected, please logout before continue.",
                    httpCode: 401
                };
            }
        }

        if(!connected)
            return {
                error: 'The requested api could not be found'
            };

        for(var key in config)
        {
            if(checkConfig(key))
            {
                if(!this.sessionHasRole(session, key))
                {
                    const msg = this.roleDeniedMessage(session, key, api, connected);
                    if(msg !== false)
                    {
                        return msg;
                    }
                }
                else
                {
                    return true;
                }
            }
        }

        return {
            error: 'The requested api could not be found'
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
        return {};
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
    * @param api_name {String}
    * @returns {Object}
    */
    getApiContext(name)
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

    /**
    * Call an api from an http request
    * @async
    * @param api_name {String}
    * @param post {Object}
    * @param req {Object}
    * @param token_changed_cb {Function}
    * @return {Promise<Object>} The reponse object of the api.
    */
    async api(name, post, req, tokenChangeNotify)
    {
        const oToken  = req.cookies.token;
        const session = this.sessionsManager.getFromCookies(req.cookies);

        if (req !== undefined)
            session.updateCookies(req.cookies);

        if (session.token !== oToken && tokenChangeNotify)
            tokenChangeNotify(session.token, session.expirationTime, oToken);

        await session.onReady();

        const permission = this.checkPermission(session, name, post);
        if (permission !== true)
            throw(permission);

        return await session.api(name, post, req.client_ip, req.files, req.get);
    }


    //------------------------------------------

    /**
    * Handle an api for an http request
    * @param req {Object}
    * @param res {Object}
    */
    handleApi(req, res, offset)
    {
        const _this = this;

        if (offset === undefined)
            offset = 0;

        try
        {
            var path = req.url.substr(1 + offset);

            function handleResult(result)
            {
                if(req.timedout) {
                    console.error('{handleApi-Result}', path, 'Response received after timeout');
                    return;
                }

                try
                {
                    res.setHeader('Content-Type', 'application/json');
                    res.send(JSON.stringify(result));
                }
                catch (e)
                {
                    console.error('{handleApi-Result}', e);
                    _this.sendErrorPage(500, req, res);
                }
            }

            if (path.indexOf('/') == -1)
                return handleResult({ error: 'Bad api path format found' });

            req.get = {};
            if(path.indexOf('?') !== -1)
            {
                const querystring = require('querystring');

                const getIndex = path.indexOf('?');
                req.get = querystring.parse(path.substr(getIndex+1));
                path = path.substr(0, getIndex);
            }

            this.api(path, req.body, req, function(token, expiration, otoken)
            {
                const d = new Date();
                d.setTime(expiration);
                const expires = 'expires=' + d.toUTCString() + ';';

                res.setHeader('Set-Cookie', 'token=' + token + ';' + expires + 'path=/');
            })
            .then(handleResult).catch(function(err)
            {
                try
                {
                    if (err.httpCode)
                    {
                        res.status(err.httpCode);
                        delete err.httpCode;
                    }
                    else
                    {
                        res.status(400);
                    }
                }
                catch (e)
                {
                    console.error('{handleApi}', e);
                }

                if (typeof (err) === 'object' || typeof (err) === 'array')
                {
                    if (err.error !== undefined)
                    {
                        return handleResult(err);
                    }
                    else if (err.message !== undefined)
                    {
                        console.error('{handleApi}', err);
                        return handleResult({ error: err.message });
                    }
                }
                else if (typeof (err) === 'string')
                {
                    return handleResult({ error: err });
                }

                _this.sendErrorPage(400, req, res);
            });
        }
        catch (e)
        {
            console.error('{handleApi}', e);
            this.sendErrorPage(500, req, res);
        }

        return this;
    }

    preHandle(req, res, prePath)
    {
        if(prePath !== 'api')
            return super.preHandle(req, res, prePath);

        this.handleApi(req, res, 4);
        return true;
    }
}

module.exports = SiteManager;