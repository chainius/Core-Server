// const renderer    = require('vue-server-renderer');
const Path = require('path')
const PassThrough = require('stream').PassThrough
const Watcher = plugins.require('http/Watcher')
const fs = require('fs')

const renderer = require('vue-server-renderer') // require('../additionals/vue-server-renderer/custom/index.js');
const isProduction = (process.env.NODE_ENV === 'production')

class RenderCache {

    constructor(session) {
        this.session = session
        this.cache = {}
        this.preloadedApis = {}
        this.urlApiData = {}
        this.client_ip = null
        this.cacheTTL = 10 * 60 * 1000
        
        this.lru = this
        
        this.createRenderer()

        if(!RenderCache.bundle)
            this.loadPreloads()

        if (!isProduction) {
            const _this = this
            Watcher.onFileChange(RenderCache.serverJavascriptPath, function () {
                _this.bundleChanged()
            })
        }

        (setTimeout(() => {
            this.deleteCache()
        }, this.cacheTTL)).unref()
    }

    createRenderer() {
        const overwriteTemplate = Path.join(process.cwd(), 'resources', 'template.html')
        this.templatePath = fs.existsSync(overwriteTemplate) ? overwriteTemplate : Path.normalize(__dirname + '/../modules-www/template.html')

        if (process.env.NODE_ENV !== 'production') {
            Watcher.onFileChange(overwriteTemplate, () => {
                console.log('HTML Template changed')
                
                this.templatePath = overwriteTemplate
                const template = fs.readFileSync(overwriteTemplate).toString()
                
                this.renderer = renderer.createRenderer({
                    basedir:  process.cwd(),
                    cache:    this.lru,
                    template: template
                })
            })
        }

        const template = fs.readFileSync(this.templatePath).toString()

        this.renderer = renderer.createRenderer({
            basedir:  process.cwd(),
            cache:    this.lru,
            template: template
        })
    }
    
    deleteCache() {
        this.cache = {}
        this.urlApiData = {}
        this.preloadedApis = {}
        
        setTimeout(() => {
            this.deleteCache()
        }, this.cacheTTL)
    }

    bundleChanged() {
        try {
            console.warn('Bundle changed, deleting cache')
            this.deleteCache()
            this.loadPreloads()
        } catch (e) {
            console.error(e)
        }
    }
    
    createContext(url) {
        const _this = this
        const resources = this.session.siteManager.resourceManager

        return {
            url: url,
            api: function (name, post) {
                const salt = _this.getSalt(name, post || {})
                const data = _this.preloadedApis[salt]

                if (data)
                    api_data[salt] = data

                return data
            },

            cssHash: isProduction ? resources.getObject('/css/bundle.css').getHash() : 'dev',
            jsHash:  isProduction ? resources.getObject('/lib/bundle.js').getHash() : 'dev',
            lang:    'en',
            // meta:    {}
        }
    }
    
    createStream(context) {
        const res = new PassThrough()
        const _this = this

        if(RenderCache.bundle === null)
            return null // ToDo if ui option is enabled => await RenderCache.bundle is not null

        if(!RenderCache.bundle.default)
            throw('The Bundle contains some errors and could not be loaded')
        
        RenderCache.bundle.default(context).then(function (app) {
            const renderStream = _this.renderer.renderToStream(app, context)

            renderStream.on('error', err => {
                console.error(err)
                res.emit('error', err)
            })

            renderStream.pipe(res)
        })
            .catch(function (err) {
                console.error(err)
                process.nextTick(() => {
                    res.emit('error', err)
                })
            })

        return res
    }

    renderToStream(url) {
        try {
            const api_data = this.urlApiData[url] || {}

            const ctx = this.createContext(url)

            const stream = this.createStream(ctx)
            ctx.api_data = api_data
            this.urlApiData[url] = api_data

            return {
                ctx:    ctx,
                stream: stream,
                error:  RenderCache.error
            }
        } catch(e) {
            if(RenderCache.bundle === {}) {
                console.warn('Force reloading bundle')
                this.loadPreloads()
                return null
            }

            console.error(e)
        }

        return null
    }

    onRouterDone(app, context, resolve, reject) {
        // const context = this.createContext(app.$route.path);

        this.renderer.renderToString(app, context, (err, html) => {
            var code = 200

            if(app.$route.meta && app.$route.meta.httpCode && html)
                code = app.$route.meta.httpCode

            if(err) 
                reject(err)
            else 
                resolve({ html, httpCode: code })
        })
    }

    renderToString(url) {
        const _this = this
        return new Promise(function(resolve, reject) {
            const ctx = _this.createContext(url)

            if(!RenderCache.bundle.default)
                return reject('The Bundle contains some errors and could not be loaded')

            RenderCache.bundle.default(ctx).then((app) => {
                _this.onRouterDone(app, ctx, resolve, reject)
            }).catch(reject)
        })
    }
    
    //-------------------------------------------------------

    getSalt(api, data) {
        var dataJ = JSON.stringify(data)
        if (dataJ.length == 0) 
            return api

        var char, hash = 0
        for (var i = 0; i < dataJ.length; i++) {
            char = dataJ.charCodeAt(i)
            hash = ((hash << 5) - hash) + char
            hash = hash & hash
        }
        return api + '_' + Math.abs(hash)
    }

    api(name, data) {
        return this.session.api(name, data, this.$req)
    }

    preload(componentData, componentName) {
        const api = componentData.api
        var post = componentData.api_data || {}

        if (RenderCache.bundle) {
            if (RenderCache.bundle.transformPost)
                post = RenderCache.bundle.transformPost(post, api)
        }

        if (!api) {
            this.logError('Preload required on component', componentName, 'but no api found in the data')

            return new Promise(function (resolve) {
                resolve()
            })
        }

        const salt = this.getSalt(api, post)
        const _this = this

        if (this.preloadedApis[salt]) {
            const res = this.preloadedApis[salt]
            return new Promise(function (resolve) {
                resolve(res)
            })
        }

        return this.api(api, post).then(function (result) {
            _this.preloadedApis[salt] = result
            return result
        })
            .catch(function (err) {
                console.error('Preload', api, ':', err)
                return []
            })
    }

    //-------------------------------------------------------

    get(key, cb) {
        cb(this.cache[key])
    }

    set(key, val) {
        this.cache[key] = val
    }

    has(key, cb) {
        if (this.cache[key])
            return cb(true)

        const pageName = key.substr(0, key.indexOf('::'))

        if (RenderCache.preloads[pageName]) {
            try {
                const props = JSON.parse(key.substr(key.indexOf('::') + 2))
                props.$store = {}
                const data = RenderCache.preloads[pageName].call(props, [])
                console.log('Preload api\'s for component', pageName)
                const _this = this

                var done = false
                setTimeout(function() { // ToDo on api error or timeout => do not store cache
                    if(!done) {
                        console.warn('Preload timeout reached', data, pageName)
                        cb(false)
                    }

                    done = true
                }, 500)

                return this.preload(data, pageName).then(function() {
                    if(!done)
                        cb(false)

                    done = true
                })
            } catch (e) {
                console.error(e)
            }
        }

        return cb(false)
    }

    //-------------------------------------------------------
    
    loadPreloads() {
        try {
            delete require.cache[require.resolve(RenderCache.serverJavascriptPath)]
            RenderCache.bundle = require(RenderCache.serverJavascriptPath)
            
            if(RenderCache.bundle.preloads) {
                RenderCache.preloads = RenderCache.bundle.preloads()
                RenderCache.error = null
            }
        } catch (e) {
            console.error(e)
        }
    }
}

//--------------------------------------------------------------------------------------------------
// Statics

RenderCache.serverJavascriptPath = Path.join(process.cwd(), 'dist', 'bundle-server.js')
RenderCache.bundle = null
RenderCache.preloads = {}
RenderCache.error = null

module.exports = RenderCache
