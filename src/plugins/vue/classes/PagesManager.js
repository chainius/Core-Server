//const SocketServer = plugins.require('vue/hmr/socket-server');

class PagesManager
{
    constructor(siteManager)
    {
        this.isProduction   = (process.env.NODE_ENV === 'production');
        //this.hmrSocket      = new SocketServer(this);

        if(siteManager) {
            this.siteManager    = siteManager;

            if(siteManager.getSession)
                this.globalSession  = siteManager.getSession('__global__');
        }
    }

    //--------------------------------

    handleRequest(req, res) {
        const ToString = true;
        
        if(ToString) {
            return this.renderToString(req.url).then(function(r) {
                res.writeHead(r.httpCode || 200, { 'Content-Type': 'text/html; charset=utf-8' });

                if(req.apiData) {
                    res.end(r.html.replace('window.API_DATA = {}', 'window.API_DATA = ' + JSON.stringify(req.apiData)));
                } else {
                    res.end(r.html);
                }

                return r;
            })
        } else {
            res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });

            const stream = this.getRenderStream(req);
        
            stream.stream.on('data', function(chunk)
            {
                res.write(chunk);
            });

            stream.stream.on('end', function(chunk)
            {
                res.end();
            });

            return stream;
        }
    }
    
    getCacheObject(name)
    {
        return this.siteManager.resourceManager.getObject(name);
    }
    
    getRenderStream(req)
    {
        const renderCache = this.globalSession.getComponentsCache();
        const result      = renderCache.renderToStream(req.url);
        return result;
    }
    
    renderToString(url) {
        const renderCache = this.globalSession.getComponentsCache();
        return renderCache.renderToString(url);
    }

    //--------------------------------

    async handleError(code, req, res)
    {
        if(req.ended || res.finished) {
            console.error('Try to send error page with code', code, ' on closed request', req.url);
            return false;
        }

        try
        {
            const r = await this.renderToString('/error/' + code);
            res.writeHead(code, { 'Content-Type': 'text/html; charset=utf-8' });
            res.end(r.html);
            return true;
        }
        catch (e)
        {
            console.error(e);
        }

        try
        {
            res.writeHead(code, { 'Content-Type': 'text/html; charset=utf-8' });
            res.end('An unexpected error occured');
            return true;
        }
        catch (e)
        {
            console.error(e);
        }

        return false;
    }
}

function ensureExists(path, mask, cb) {
    const fs  = require('fs');

    fs.mkdir(path, mask, function(err) {
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
        
        //-----------------------------------------------------

        if(!globConfig)
            globConfig = {
                jquery: (plugins.projectConfig.jquery === false ? false : true)
            }

        if (['client', 'server'].indexOf(mode) === -1)
            throw('Wrong bundle type given', mode);

        //-----------------------------------------------------

        const isProduction = (process.env.NODE_ENV === 'production');

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

        const config = {
            entries:        Path.join(__dirname, '..', 'modules-www', mode, 'entry.js'),
            basedir:        process.cwd(),
            fullPaths:      !isProduction,
            paths: [
                Path.join(process.pwd(), 'node_modules'),
                Path.join(__dirname, '..', 'node_modules'),
                Path.join(process.cwd(), 'node_modules'),
                process.cwd()
            ],
            
            environment: {
                _: 'purge',
                NODE_ENV: process.env.NODE_ENV,
                VUE_ENV: mode,
                COMPILE_ENV: 'browserify',
                DEBUG: false
            },

            process: {
                env: {
                    NODE_ENV:         process.env.NODE_ENV,
                    NODE_PATH:        Path.join(process.cwd(), 'node_modules'),
                    READABLE_STREAM:  'disable'
                }
            },

            insertGlobalVars: insertGlobalVars,
            isServer: (mode === 'server')
        };
        
        //--------------------------------------------------------
        
        if(!isProduction) {
            const BrowserifyCache = require('../additionals/watchify-cache.js');
            const cacheFile     = Path.join(process.cwd(), 'dist', 'cache-' + mode + '.json');
            const cache         = BrowserifyCache.getCache(cacheFile);

            config.cache        = cache.cache;
            config.packageCache = cache.package;
            config.stylesCache  = cache.styles;
            config.cacheFile    = cacheFile;
        } else {
            config.cache        = {};
            config.packageCache = {};
            config.stylesCache  = {};
        }

        if (config.isServer)
            config.standalone = 'server';
        
        return config;
    },
    
    setupTransforms(config, mode, distFolder) {
        const isProduction      = (process.env.NODE_ENV === 'production');
        const babelify          = require('babelify');
        const vueify            = require('../vueify');
        const bulkify           = require('../additionals/bulkify.js');
        const envify            = require('envify/custom');
        const fs                = require('fs');
        
        var babelrc = { presets: ['@babel/preset-env'] };
        
        try {
            const babelContent = fs.readFileSync(process.cwd() + '/.babelrc')
            babelrc = JSON.parse(babelContent);
        } catch(e) {
            if(e.code !== 'ENOENT')
                console.error(e);
        }

        this.transform(vueify)
                .transform(babelify, babelrc)
                .transform(bulkify)
                .transform({ global: isProduction }, envify(config.environment));
    },
    
    setupPlugins(config, mode, distFolder) {
        const isProduction      = (process.env.NODE_ENV === 'production');
        const Path              = require('path');

        PagesManager.BrowserifySetup.setupTransforms.apply(this, arguments);

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

            /*if (!config.isServer && !config.disableHmr) {
                const browhmr = plugins.require('vue/hmr/index');
                this.plugin(browhmr);
            }*/
        }
    }
}

function bundle(path, bundler, done) {
    const fs     = require('fs');
    const stream = fs.createWriteStream(path);

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

PagesManager.ensureExists = ensureExists;
PagesManager.compile = function(mode, done, globConfig) {

    const Path              = require('path');
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

    const destPath = Path.join(distFolder, 'bundle-' + mode + '.js');

    if (!isProduction && process.options.hot !== undefined)
    {
        bundler.on('update', function()
        {
            bundle(destPath, bundler, done);
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
            bundle(destPath, bundler, done);
        }
    });

    return bundler;
}

module.exports = PagesManager;