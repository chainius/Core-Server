'use strict';

const ResourceManager = plugins.require('web-server/Resources/Manager');
const Watcher         = plugins.require('web-server/Watcher');

/** SiteManager */
class SiteManager
{
    constructor()
    {
        //this.title              = 'CoreServer';
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
            plugins.require('web-server/Crypter').setRecaptchaConfig(config.recaptcha);

        if (config.crypter_iv)
            plugins.require('web-server/Crypter').setCrypterIv(config.crypter_iv);
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
            const prodPath = basePath + '-online.json';
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
            res.status(code);
            res.send('An error occured on the requested page (code: ' + code + ')');
        }
        catch (err)
        {
            console.error(err);
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
    handle(req, res)
    {
        try
        {
            var path = req.url.split('/');
            if(path[0] === '')
                path.shift();

            return this.preHandle(req, res, path[0]);
        }
        catch (e)
        {
            console.error(e);
            this.sendErrorPage(500, req, res);
        }

        return false;
    }
}

module.exports = SiteManager;