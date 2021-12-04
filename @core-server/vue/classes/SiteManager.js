const helmet = require('helmet')

class SiteManager extends SuperClass {

    constructor(httpServer) {
        super(httpServer)

        this._helmet = helmet()
        this.pagesCache = {}
        const _this = this

        process.nextTick(() => {
            const PagesManager = plugins.require('vue/PagesManager')
            _this.pagesManager = new PagesManager(_this)
        })
    }

    sendErrorPage(code, req, res) {
        if(this.pagesManager)
            return this.pagesManager.handleError(code, req, res).catch(function(err) {
                console.error(err)
            })
        else
            return super.sendErrorPage(code, req, res)
    }

    handleVueJs(req, res) {
        try {
            if(!this.pagesManager) {

                if(!disableForce) {
                    process.nextTick(() => {
                        _this.handle(req, res, true)
                    })
                } else {
                    console.error('PagesManager not found')
                    this.sendErrorPage(500, req, res)
                }

                return true
            }

            //-----------------------------------------------------------------

            var index = req.url.indexOf('?')
            var url = index >= 0 ? req.url.substr(0, index) : req.url

            const _this = this
            function handle() {
                if(this.pagesCache[url] && process.env.NODE_ENV === 'production') {
                    const r = this.pagesCache[url]

                    res.writeHead(r.httpCode || 200, { 'Content-Type': 'text/html; charset=utf-8' })
                    res.end(r.html)
                    return
                }

                this.pagesManager.handleRequest(req, res).then((r) => {
                    this.pagesCache[url] = r
                }).catch(function(err) {
                    console.error(err)
                })
            }

            if(res._headerSent) {
                handle.call(this)
            } else {
                this._helmet(req, res, () => {
                    handle.call(this)
                })
            }
        } catch (e) {
            console.error(e)
            this.sendErrorPage(500, req, res)
        }
    }
    
    handle(req, res, disableForce) {
        try {
            if(!super.handle(req, res)) {
                this.handleVueJs(req, res)
            }
        } catch (e) {
            console.error(e)
            this.sendErrorPage(500, req, res)
        }

        return true
    }
}

module.exports = SiteManager