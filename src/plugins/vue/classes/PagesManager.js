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
                this.globalSession  = siteManager.getSession('global');
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

    //--------------------------------

    async handleError(code, req, res)
    {
        try
        {
            const r = await this.getRenderStream({ url: '/error/' + code });

            if(r === null)
            {
                res.status(code);
                res.setHeader('Content-Type', 'text/html; charset=utf-8');
                res.write('An unexpected error occured');
                res.end();
                return;
            }

            return this.handleVueStream(r.stream, r.ctx, req, res, code);
        }
        catch (e)
        {
            console.error(e);
        }

        try
        {
            res.status(code);
            res.setHeader('Content-Type', 'text/html; charset=utf-8');
            res.write('An unexpected error occured');
            res.end();
        }
        catch (e)
        {
            console.error(e);
        }
    }

    handleVueStream(stream, ctx, req, res, code)
    {
        const _this     = this;
        var isInited    = false;
        var lang        = 'en';

        function init()
        {
            try
            {
                const {
                  title, htmlAttrs, bodyAttrs, link, style, script, noscript, meta,
                } = ctx.metatags.inject();

                isInited = true;
                code     = code || ctx.meta.httpCode || 200;
                res.status(code);
                res.setHeader('Content-Type', 'text/html; charset=utf-8');
                res.write(`<html lang="en" data-vue-meta-server-rendered ${htmlAttrs.text()}>`);
                res.write(`<head>`);
                res.write(`<meta charset="utf-8">`);
                res.write(`<meta name="viewport" content="width=device-width, initial-scale=1">`);
                res.write(`<link rel="icon" type="image/png" href="/img/favicon.png" />`);
                res.write(title.text ? title.text() : `<title>${_this.siteManager.title}</title>`);
                res.write(`
                  ${meta.text()}
                  ${link.text()}
                  ${style.text()}
                  ${script.text()}
                  ${noscript.text()}
                `);

                if(code !== 200 && code !== 404)
                    res.write(`<script>window.HTTP_STATUS = ${code}; </script>`);

                /*try
                {
                    _this.siteManager.setPageMeta(req, res);
                }
                catch (e)
                {
                    console.error(e);
                }*/

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
                    init();

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
                res.write(`  <script src="https://cdn.polyfill.io/v2/polyfill.min.js?features=Intl.~locale.${lang}"></script>`);

                if(ctx.state)
                    res.write(`<script>window.STATE = JSON.parse('${JSON.stringify(ctx.state)}')</script>`);

                res.write(`<script>window.API_DATA = ${JSON.stringify(ctx.api_data)}</script>`);
                res.write(`<script src="/lib/bundle.js?${hash}"></script>`);
                res.write(`</body>`);
                res.write(`</html>`);
                res.end();
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
                res.status(500).end('An internal error occured');
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

PagesManager.compile = function(mode, done) {

    //const snapRequire  = require('./additionals/snapshotRequire.js');

    const Path              = require('path');
    const fs                = require('fs');
    const browserify        = require('browserify');
    const babelify          = require('babelify');
    const watchify          = require('watchify');
    const envify            = require('envify/custom');
    const BrowserifyCache   = require('../additionals/watchify-cache.js');
    const bulkify           = require('../additionals/bulkify.js');
    const blukifyWatch      = require('../additionals/bulkify-watch.js');
    const vueify            = require('../vueify');
    const extractCss        = require('../vueify/plugins/extract-css.js');
    const browhmr           = plugins.require('vue/hmr/index');

    //--------------------------------------------------------

    const isServer = (mode === 'server');
    const isProduction = (process.env.NODE_ENV === 'production');
    const cacheFile = Path.join(process.cwd(), 'dist', 'cache-' + mode + '.json');

    const vuePath = fs.existsSync(Path.join(__dirname, '..', 'node_modules', 'vue')) ? Path.join(__dirname, '..', 'node_modules', 'vue') : Path.join(process.pwd(), 'node_modules', 'vue');
    //const jqueryPath = fs.existsSync(Path.join(__dirname, '..', 'node_modules', 'jquery')) ? Path.join(__dirname, '..', 'node_modules', 'jquery') : Path.join(process.pwd(), 'node_modules', 'jquery');

    const cache = BrowserifyCache.getCache(cacheFile);
    const config = {
        //entries: Path.join('resources', 'core-lib', mode, 'entry.js'),
        entries: Path.join(__dirname, '..', 'modules-www', mode, 'entry.js'),
        basedir: process.cwd(),
        cache: cache.cache,
        packageCache: cache.package,
        stylesCache: cache.styles,
        cacheFile: cacheFile,
        fullPaths: !isProduction,
        paths: [Path.join(process.cwd(), 'node_modules'), process.cwd(), Path.join(process.pwd(), 'node_modules'), Path.join(__dirname, '..', 'node_modules')],

        process: {
            env: {
                NODE_ENV: process.env.NODE_ENV,
                NODE_PATH: Path.join(process.cwd(), 'node_modules'),
                READABLE_STREAM: 'disable'
            }
        },

        insertGlobalVars: {
            jQuery: function(file, dir)
            {
                return 'require("jquery")';
            },

            '$': function(file, dir)
            {
                return 'require("jquery")';
            },

            InitReq: function(file, dir)
            {
                const fdir = Path.join(process.cwd(), 'resources', 'lib', 'init.js');
                return 'require("'+fdir+'")';
            },

            Vue: function(file, dir)
            {
                return 'require("'+vuePath+'")';
            }
        },

        isServer: isServer
    };

    if (isServer)
        config.standalone = 'server';

    var b = browserify(config)
                .transform(vueify)
                .transform(babelify, {presets: ['es2015']})
                .transform(bulkify)
                .transform({ global: isProduction }, envify({
                    _: 'purge',
                    NODE_ENV: process.env.NODE_ENV,
                    VUE_ENV: mode,
                    COMPILE_ENV: 'browserify',
                    DEBUG: false
                }));

    //b.plugin(snapRequire);

    const distFolder = Path.join(process.cwd(), 'dist');
    if (!isServer)
    {
        b.plugin(extractCss, {
            out: Path.join(distFolder, 'bundle.css'),
            minify: isProduction
        });
    }

    if (!isProduction && process.options.hot !== undefined)
    {
        //browserifyInc(b, {cacheFile: process.cwd() + '/dist/browserify-cache-' + mode + '.json'});
        b.plugin(BrowserifyCache).plugin(watchify);
        b.plugin(blukifyWatch);

        b.on('update', function()
        {
            b.bundle(function()
            {
                done.apply(this, arguments);
            })
             .pipe(fs.createWriteStream(Path.join(distFolder, 'bundle-' + mode + '.js')));
        });

        if (!isServer)
            b.plugin(browhmr);
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
                done.apply(b, arguments);
            });

            stream.on('error', function(err)
            {
                console.error('browserify-stream:', err);
            });

            b.bundle().on('error', function(err)
            {
                console.error('Browserify-bundle:', err.message);
            })
            .pipe(stream);
        }
    });

    return b;
}

module.exports = PagesManager;