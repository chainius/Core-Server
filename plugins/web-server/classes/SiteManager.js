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
            const prodPath = basePath + '-production.json';
            const fs       = require('fs');

            if (fs.existsSync(prodPath))
                return this.getConfigByPath(name, prodPath);
        }

        return this.getConfigByPath(name, basePath + '.json');
    }

    /**
    * Broadcast a message over a channel using the redis service
    * @param channel {String}
    * @param msg {String|Object}
    */
    /*broadcast(channel, msg)
    {
        try
        {
            if(!this.redis)
            {
                console.warn('Cannot broadcast redis event, redis server not instantiated');
                return;
            }

            this.redis.emit(channel, msg);
        }
        catch(e)
        {
            console.error(e);
        }
    }*/

    /**
    * Listen to a redis broadcast channel
    * @param channel {String}
    * @param callback {Function}
    */
    /*onBroadcast(channel, cb)
    {
        if (!this.redis)
            return console.error('Please instantiate a redis server before listening some broadcast events');

        this.redis.onChannel(channel, cb);
    }*/

    /**
    * Broadcast a message to all users
    * @param api {String}
    * @param data {Object}
    * @param Selector {Optional, Object(MongoDb selector on session or cookie data)}
    */
    /*live(api, data, selector) {
        throw('ToDo implement function')
        //...

        //ToDo send over redis, on redis broadcast received => send to liveInternal
    }*/

    /**
    * Broadcast a message to all users that are connected to this node
    * @param api {String}
    * @param data {Object}
    * @param Selector {Optional, Object(MongoDb selector on session or cookie data)}
    */
    /*liveInternal(api, data, salt, selector) {
        if(typeof(salt) === 'object')
        {
            selector = salt;
            salt = undefined;
        }

        if(selector)
            throw('ToDo implement selector function')

        const sessions = this.sessionsManager.sessions;

        for(var key in sessions) {

            //ToDo check with selector

            sessions[key].broadcastSocketMessage({
                api: api,
                data: data,
                salt: salt || this.getSalt(api, {})
            });

        }
    }*/

    //------------------------------------------

    /**
    * Add additionals meta data to a page
    * @param req {Object}
    * @param res {Object}
    */
    /*setPageMeta(req, res)
    {
        return true;
    }*/

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