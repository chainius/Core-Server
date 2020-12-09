'use strict';

const ResourceManager = plugins.require('http/Resources/Manager');
const Watcher         = plugins.require('http/Watcher');

/** SiteManager */
class SiteManager
{
    constructor(server)
    {
        this._routerHandlers    = [];
        this.server             = server;
        this.resourceManager    = new ResourceManager(this);
        this.configs            = {};

        this.autoSetupFromConfig();
    }

    /**
    * Load the config files of the site and handle it
    */
    autoSetupFromConfig()
    {
        const config = this.getConfig('servers');

        if (config.recaptcha)
            plugins.require('http/Crypter').setRecaptchaConfig(config.recaptcha);

        if (config.crypter_iv)
            plugins.require('http/Crypter').setCrypterIv(config.crypter_iv);
    }

    //------------------------------------------

    /**
    * Load a JSON configuration from a given path, the key represents a caching key
    * @param key {String}
    * @param path {String}
    */
    getConfigByPath(key, path)
    {
        if (this.configs[key])
            return this.configs[key];

        const _this = this;
        Watcher.onFileChange(path, function()
        {
            console.warn('Config file changed:', key);
            _this.configs[key] = undefined;
        });

        try
        {
            const fs          = require('fs');
            const content     = fs.readFileSync(path);
            this.configs[key] = JSON.parse(content);
            return this.configs[key];
        }
        catch (e)
        {
            if(e.code !== 'ENOENT')
                console.error(e);
        }

        return {};
    }

    /**
    * Load a JSON configuration from the config directory of the iste
    * @param name {String}
    */
    getConfig(name)
    {
        if (this.configs[name])
            return this.configs[name];

        const Path     = require('path');
        const basePath = Path.join(process.cwd(), 'config', name);

        if (process.env.NODE_ENV === 'production')
        {
            const prodPath = basePath + '-production.json';
            const fs       = require('fs');

            if (fs.existsSync(prodPath))
                return this.getConfigByPath(name, prodPath);
        }

        return this.getConfigByPath(name, basePath + '.json');
    }

    //------------------------------------------

    /**
    * Remove an object from the CDN and locally memory
    * @param file_name {String}
    */
    purgeCache(name)
    {
        try
        {
            if (process.env.NODE_ENV !== 'production')
                console.warn('Clearing cache for resource', name);

            const object = this.resourceManager.getObject('/' + name);
            if (object)
                object.purge();
        }
        catch (e)
        {
            console.error(e);
        }
    }

    //------------------------------------------

    /**
    * Sen an error page to the given request
    * @param code {Number}
    * @param req {Object}
    * @param res {Object}
    */
    sendErrorPage(code, req, res)
    {
        try
        {
            res.writeHead(code, { 'Content-Type': 'text/html; charset=utf-8' });
            res.end('An error occured on the requested page (code: ' + code + ')');
        }
        catch (err)
        {
            console.error('{sendErrorPage}', err);
        }
    }

    preHandle(req, res, prePath) {
        const preHandle = this.resourceManager.handle(req, res, prePath);
        if (preHandle === true)
            return true;

        return false;
    }

    /**
    * Handle the incoming http request
    * @param req {Object}
    * @param res {Object}
    */
    handle(req, res) {
        const final = () => {
            try {
                const firstSlash = req.url[0] === '/' ? 1 : 0;
                return this.preHandle(req, res, req.url.substr(firstSlash, req.url.indexOf('/', 1) - firstSlash));
            }
            catch (e) {
                console.error('{handle}', e);
                this.sendErrorPage(500, req, res);
            }

            return false
        }

        if(this._routerHandlers.length === 0)
            return final()

        const handlers = this._routerHandlers.filter((o) => (!o.method || o.method === req.method) && (!o.path || req.url.match(o.path))).map((r) => r.fn)
        if(handlers.length === 0)
            return final()

        const next = (i) => {
            if(i >= handlers.length)
                return final()

            return handlers[i](req, res, function() {
                return next(i+1)
            })
        }

        return next(0);
    }

    use(method, path, fn) {
        if(!fn) {
            fn = path
            path = method
            method = undefined
        }

        if(!fn) {
            fn = path
            path = '*'
        }

        if(path === '*') {
            path = undefined
        } else if(typeof(path) === 'string') {
            const minimatch = require("minimatch")
            path = minimatch.makeRe(path)
        }

        this._routerHandlers.push({ method, path, fn })
        return this
    }

    post(path, fn) {
        return this.use('POST', path, fn)
    }
}

module.exports = SiteManager;