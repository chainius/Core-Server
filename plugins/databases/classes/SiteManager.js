'use strict';

/** SiteManager */
class SiteManager extends SuperClass
{
    /**
    * Load the config files of the site and handle it
    */
    autoSetupFromConfig()
    {
        super.autoSetupFromConfig();

        const config = this.getConfig('servers');

        if (config.mysql)
            this.setupMysql(config.mysql);

        if (config.cloudflare)
            this.setupCloudflare(config.cloudflare);

        if (config.mongodb)
            this.setupMongodb(config.mongodb);
    }

    //------------------------------------------

    /**
    * Setup a cloudflare api link
    * @param config {Object}
    */
    setupCloudflare(config)
    {
        this.connections = this.connections || {};

        try
        {
            if (config === undefined)
                config = this.getConfig('servers').cloudflare;

            const Cloudflare = require('cloudflare');
            this.connections.cloudflare = new Cloudflare(config);

            //-------------------------------------------------------

            if(process.env.NODE_ENV === 'production' && config["zone-id"])
            {
                console.log("Purging cloudflare cache..");

                cloudflare.deleteCache(config["zone-id"], {
                    purge_everything: true
                })
                .then(function()
                {
                    console.log('Cloudflare cache successfully purged')
                })
                .catch(function(err)
                {
                    console.error(err);
                });
            }

        }
        catch (e)
        {
            console.error(e);
        }
    }

    /**
    * Setup a mongodb connection that will be used by the api's
    * @param config {Object}
    */
    setupMongodb(config)
    {
        this.connections = this.connections || {};

        try
        {
            if (config === undefined)
                config = this.getConfig('servers').mongodb;

            const Mongodb = plugins.require('databases/Mongodb');
            this.connections.mongodb  = new Mongodb(config);
        }
        catch (e)
        {
            console.error(e);
        }
    }

    /**
    * Setup a database connection that will be used by the api's
    * @param config {Object}
    */
    setupMysql(config)
    {
        this.connections = this.connections || {};

        try
        {
            if (config === undefined)
                config = this.getConfig('servers').mysql;

            const Mysql = plugins.require('databases/Mysql');
            this.connections.mysql  = new Mysql(config);
        }
        catch (e)
        {
            console.error(e);
        }
    }


}

module.exports = SiteManager;