const SocketServer = plugins.require('vue/hmr/socket-server');

class PagesManager
{
    constructor(siteManager)
    {
        this.isProduction   = (process.env.NODE_ENV === 'production');
        this.hmrSocket      = new SocketServer(this);

        if(siteManager) {
            this.siteManager    = siteManager;

            if(siteManager.getSession)
                this.globalSession  = siteManager.getSession('__global__');
        }
    }

    //--------------------------------

    getRenderStream(req)
    {
        const _this        = this;

        return new Promise(function(resolve, reject)
        {
            if(!_this.globalSession)
                reject('No session found for the cache streams');

            function tryCreate()
            {
                try
                {
                    //ToDo if no session create cache..
                    const renderCache = _this.globalSession.getComponentsCache();
                    const result      = renderCache.renderToStream(req.url);

                    if (req.timedout)
                    {
                        reject('Request timeout reached');
                    }
                    else
                    {
                        resolve(result);
                    }

                    return true;
                }
                catch (e)
                {
                    console.error(e);

                    if (req.timedout)
                    {
                        reject(e);
                        return true;
                    }

                    return false;
                }
            }

            if (!tryCreate())
            {
                console.warn('Awaiting bundle in order to serve client request..');

                const interval = setInterval(function()
                {
                    if (tryCreate())
                        clearInterval(interval);
                }, 100);
            }
        });
    }

    getCacheObject(name)
    {
        return this.siteManager.resourceManager.getObject(name);
    }
    
    renderToString(url) {
        const renderCache = this.globalSession.getComponentsCache();
        return renderCache.renderToString(url);
    }

    //--------------------------------

    handleError(code, req, res)
    {
        try
        {
            return this.renderToString('/error/' + code).then(function(r) {
                res.writeHead(code, { 'Content-Type': 'text/html; charset=utf-8' });
                res.end(r.html);
            }).catch(function(err) {
                res.writeHead(code, { 'Content-Type': 'text/html; charset=utf-8' });
                res.end(`An unexpected error occured ${err.message || err}`);
            });
        }
        catch (e)
        {
            console.error(e);
        }

        return new Promise(function(resolve) {
            res.writeHead(code, { 'Content-Type': 'text/html; charset=utf-8' });
            res.end('An unexpected error occured');
            resolve();
        })
        /*try
        {
            res.writeHead(code, { 'Content-Type': 'text/html; charset=utf-8' });
            res.end('An unexpected error occured');
        }
        catch (e)
        {
            console.error(e);
        }*/
    }

    handleVueStream(stream, ctx, req, res, code)
    {
        const _this     = this;
        var isInited    = false;
        var lang        = 'en';

        function init(chunk)
        {
            try
            {
                const {
                  title, htmlAttrs, bodyAttrs, link, style, script, noscript, meta,
                } = ctx.metatags.inject();

                isInited = true;
                code     = code || ctx.meta.httpCode || 200;
                res.writeHead(code, { 'Content-Type': 'text/html; charset=utf-8' });
                res.write(`<html lang="en" data-vue-meta-server-rendered ${htmlAttrs.text()}>
                <head>
                <meta charset="utf-8">
                <meta name="viewport" content="width=device-width, initial-scale=1">
                <link rel="icon" type="image/png" href="/img/favicon.png" />
                ${ title.text ? title.text() : `<title>${_this.siteManager.title}</title>` }
                ${meta.text()}
                ${link.text()}
                ${style.text()}
                ${script.text()}
                ${noscript.text()}
                ${chunk}`);

                if(code !== 200 && code !== 404)
                    res.write(`<script>window.HTTP_STATUS = ${code}; </script>`);

                const hash = _this.isProduction ? _this.getCacheObject('/css/bundle.css').getHash() : 'dev';
                res.write("<link href='/css/bundle.css?"+hash+"' rel='stylesheet' type='text/css'>");
                res.write(`</head>`);
                res.write(`<body ${bodyAttrs.text()}>`);
            }
            catch (e)
            {
                console.error(e);
            }
        }

        stream.on('data', function(chunk)
        {
            try
             {
                if (!isInited)
                    init(chunk);
                else
                    res.write(chunk);
            }
            catch (e)
            {
                console.error(e);
            }
        });

        stream.on('end', function()
        {
            try
            {
                const hash = _this.isProduction ? _this.getCacheObject('/lib/bundle.js').getHash() : 'dev';
                
                //if(ctx.state)
                //res.write(`<script>window.STATE = JSON.parse('${JSON.stringify(ctx.state)}')</script>`);
                
                res.end(`<script src="https://cdn.polyfill.io/v2/polyfill.min.js?features=Intl.~locale.${lang}"></script>
                        <script>window.API_DATA = ${JSON.stringify(ctx.api_data)}</script>
                        <script src="/lib/bundle.js?${hash}"></script>
                        </body>
                        </html>`);
            }
            catch (e)
            {
                console.error(e);
            }
        });

        stream.on('error', function(error)
        {
            if (error.message === "Cannot read property 'render' of undefined")
            {
                setTimeout(function()
                {
                    _this.handle(req, res);
                }, 150);

                return;
            }

            console.error(error);
            try
            {
                res.writeHead(500, { 'Content-Type': 'text/plain' });
                res.end('An internal error occured');
            }
            catch (e)
            {
                console.error(e);
            }
        });
    }
}

function ensureExists(path, mask, cb)
{
    const fs  = require('fs');

    fs.mkdir(path, mask, function(err)
    {
        if (err)
        {
            if (err.code == 'EEXIST') cb(null); // ignore the error if the folder already exists
            else cb(err); // something else went wrong
        }
        else cb(null); // successfully created folder
    });
}

PagesManager.BrowserifySetup = {

    createConfig(mode, globConfig) {
        
        const Path              = require('path');
        const fs                = require('fs');
        const BrowserifyCache   = require('../additionals/watchify-cache.js');
        
        //-----------------------------------------------------

        if(!globConfig)
            globConfig = {
                jquery: (plugins.projectConfig.jquery === false ? false : true)
            }

        if (['client', 'server'].indexOf(mode) === -1)
            throw('Wrong bundle type given', mode);

        //-----------------------------------------------------

        const isProduction = (process.env.NODE_ENV === 'production');
        const cacheFile = Path.join(process.cwd(), 'dist', 'cache-' + mode + '.json');

        const vuePath = fs.existsSync(Path.join(__dirname, '..', 'node_modules', 'vue')) ? 
                            Path.join(__dirname, '..', 'node_modules', 'vue') : 
                            Path.join(process.pwd(), 'node_modules', 'vue');

        const insertGlobalVars = {
            InitReq: function(file, dir)
            {
                const fdir = Path.join(process.cwd(), 'resources', 'lib', 'init.js');
                return 'require("'+fdir+'")';
            },

            Vue: function(file, dir)
            {
                return 'require("'+vuePath+'")';
            },

            __FormPosterReqPath: function(file, dir) {
                const path = Path.join(__dirname, '..', 'modules-www', 'client', 'formPoster-vue.js');
                return 'require("'+path+'")';
            }
        }

        if(globConfig.jquery !== false) {
            insertGlobalVars.jQuery = insertGlobalVars.$ = function(file, dir) {
                return 'require("jquery")';
            }

            insertGlobalVars.__FormPosterReqPath = function(file, dir) {
                const path = Path.join(__dirname, '..', 'modules-www', 'client', 'formPoster-jquery.js');
                return 'require("'+path+'")';
            }
        }

        //--------------------------------------------------------

        const cache = BrowserifyCache.getCache(cacheFile);
        const config = {
            entries: Path.join(__dirname, '..', 'modules-www', mode, 'entry.js'),
            basedir: process.cwd(),
            cache: cache.cache,
            packageCache: cache.package,
            stylesCache: cache.styles,
            cacheFile: cacheFile,
            fullPaths: !isProduction,
            paths: [
                Path.join(process.cwd(), 'node_modules'),
                process.cwd(),
                Path.join(process.pwd(), 'node_modules'),
                Path.join(__dirname, '..', 'node_modules')
            ],

            process: {
                env: {
                    NODE_ENV: process.env.NODE_ENV,
                    NODE_PATH: Path.join(process.cwd(), 'node_modules'),
                    READABLE_STREAM: 'disable'
                }
            },

            insertGlobalVars: insertGlobalVars,
            isServer: (mode === 'server')
        };

        if (config.isServer)
            config.standalone = 'server';
        
        return config;
    },
    
    setupPlugins(config, mode, distFolder) {

        const isProduction      = (process.env.NODE_ENV === 'production');
        const babelify          = require('babelify');
        const vueify            = require('../vueify');
        const bulkify           = require('../additionals/bulkify.js');
        const envify            = require('envify/custom');
        const Path              = require('path');

        this.transform(vueify)
                .transform(babelify, {presets: ['env']})
                .transform(bulkify)
                .transform({ global: isProduction }, envify({
                    _: 'purge',
                    NODE_ENV: process.env.NODE_ENV,
                    VUE_ENV: mode,
                    COMPILE_ENV: 'browserify',
                    DEBUG: false
                }));
        
        //-------------

        if (!config.isServer)
        {
            const extractCss  = require('../vueify/plugins/extract-css.js');

            this.plugin(extractCss, {
                out: Path.join(distFolder, 'bundle.css'),
                minify: isProduction
            });
        }
        
        //-------------
        
        if (!isProduction && process.options.hot !== undefined)
        {
            const BrowserifyCache   = require('../additionals/watchify-cache.js');
            const watchify          = require('watchify');
            const blukifyWatch      = require('../additionals/bulkify-watch.js');

            this.plugin(BrowserifyCache)
                .plugin(watchify)
                .plugin(blukifyWatch);

            if (!config.isServer && !config.disableHmr) {
                const browhmr = plugins.require('vue/hmr/index');
                this.plugin(browhmr);
            }
        }
    }
}


PagesManager.ensureExists = ensureExists;
PagesManager.compile = function(mode, done, globConfig) {

    const Path              = require('path');
    const fs                = require('fs');
    const isProduction      = (process.env.NODE_ENV === 'production');

    const browserify        = require('browserify');
    const distFolder        = Path.join(process.cwd(), 'dist');
    
    //--------------------------------------------------------
    
    const config = PagesManager.BrowserifySetup.createConfig(mode, globConfig);
    
    if(typeof(config) !== 'object')
        throw('Wrong config type create for browserify ' + typeof(config))
    
    const bundler = browserify(config);
    
    PagesManager.BrowserifySetup.setupPlugins.call(bundler, config, mode, distFolder, bundler);

    //--------------------------------------------------------


    if (!isProduction && process.options.hot !== undefined)
    {
        bundler.on('update', function()
        {
            bundler.bundle(function()
            {
                done.apply(this, arguments);
            })
            .pipe(fs.createWriteStream(Path.join(distFolder, 'bundle-' + mode + '.js')));
        });
    }

    ensureExists(distFolder, 0o744, function(err)
    {
        if (err)
        {
            console.error(err);
        }
        else
        {
            const stream = fs.createWriteStream(Path.join(distFolder, 'bundle-' + mode + '.js'));

            stream.on('close', function()
            {
                done.apply(bundler, arguments);
            });

            stream.on('error', function(err)
            {
                console.error('browserify-stream:', err);
            });

            bundler.bundle().on('error', function(err)
            {
                console.error('Browserify-bundle:', err);
            })
            .pipe(stream);
        }
    });

    return bundler;
}

module.exports = PagesManager;