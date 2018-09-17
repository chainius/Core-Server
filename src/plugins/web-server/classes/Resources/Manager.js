const XXHash        = require('xxhashjs');
const Path          = require('path');
const cacheObject   = plugins.require('web-server/Resources/CacheObject');

class ResourcesManger
{
    constructor(siteManager)
    {
        this.siteManager = siteManager;
        this.cache = {};

        this.preload('/lib/bundle.js');
        this.preload('/css/bundle.css');

        (setInterval(() => {
            this.purgeCache();
        }, 10 * 60 * 1000)).unref();
    }
    
    purgeCache() {
        this.cache = {};
    }

    preload(name)
    {
        const object = this.getObject(name);

        if(object.stream === null)
            return;

        const _this = this;
        object.stream.on('error', function()
        {
            console.error('Preload file not found', name);
        });

        return object;
    }
    
    has(name) {
        return this.cache[name] ? true : false;
    }

    //------------------------------------------------

    createCacheName(path)
    {
        try
        {
            return XXHash.h32(path, 0xCAFEBABE).toString(16);
        }
        catch (e)
        {
            console.error(e);
        }

        return path;
    }

    getObject(name, cacheName)
    {
        if (!cacheName)
            cacheName = name;// this.createCacheName(name);

        if (this.cache[cacheName])
            return this.cache[cacheName];

        if (name === '/lib/bundle.js')
            this.cache[cacheName] = new cacheObject(Path.join(process.cwd(), 'dist', 'bundle-client.js'));
        else if( name === '/css/bundle.css')
            this.cache[cacheName] = new cacheObject(Path.join(process.cwd(), 'dist', 'bundle.css'));
        else
            this.cache[cacheName] = new cacheObject(Path.join(process.cwd(), 'resources', name));

        return this.cache[cacheName];
    }

    //------------------------------------------------

    linkCacheResult(cacheObject, req, res)
    {
        try
        {
            if(!cacheObject.exists)
                return this.siteManager.sendErrorPage(404, req, res);

            const _this = this;
            const acceptEncoding = req.headers['accept-encoding'] || '';

            res.once('readable', function()
            {
                if (acceptEncoding.match(/\bdeflate\b/))
                    res.setHeader('Content-Encoding', 'deflate');
                else if (acceptEncoding.match(/\bgzip\b/))
                    res.setHeader('Content-Encoding', 'gzip');
                
                res.writeHead(200, { 'Content-Type': cacheObject.mime });
            });

            //-------------------------------------------------------

            res.once('error', function()
            {
                _this.siteManager.sendErrorPage(404, req, res);
            });

            var pipe = null;

            if (acceptEncoding.match(/\bdeflate\b/))
                pipe = cacheObject.pipeDeflate(res);
            else if (acceptEncoding.match(/\bgzip\b/))
                pipe = cacheObject.pipeGZip(res);
            else
                pipe = cacheObject.pipe(res);

            /*pipe.on('finish', function()
            {
                console.log('finish', cacheObject.deflate.getLength());
            });*/
        }
        catch(e)
        {
            console.error(e);
        }
    }

    handle(req, res, prepath)
    {
        if (['img', 'fonts', 'lib', 'css'].indexOf(prepath) === -1)
            return prepath;

        try
        {
            var path = req.url;
            var index = path.indexOf('?');
            if (index !== -1)
                path = path.substr(0, index);

            var extension = Path.extname(path);

            if (extension == '')
                return prepath;

            //---------------------------------------

            const cacheObject = this.getObject(path);
            this.linkCacheResult(cacheObject, req, res);

            return true;
        }
        catch (e)
        {
            console.error(e);
        }

        return prepath;
    }
}

module.exports = ResourcesManger;