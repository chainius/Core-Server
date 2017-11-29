const helmet = require('helmet');

class SiteManager extends SuperClass {

    constructor(httpServer) {
        super(httpServer);

        this._helmet = helmet();
        const _this = this;

        process.nextTick(() => {
            const PagesManager = plugins.require('vue/PagesManager');
            _this.pagesManager = new PagesManager(_this);
        });
    }

    sendErrorPage(code, req, res)
    {
        if(this.pagesManager)
            return this.pagesManager.handleError(code, req, res).catch(function(err) {
                console.error(err);
            });
        else
            return super.sendErrorPage(code, req, res);
    }

    handle(req, res, disableForce)
    {
        try
        {
            if(!super.handle(req, res))
            {
                if(!this.pagesManager) {

                    if(!disableForce) {
                        process.nextTick(() => {
                            _this.handle(req, res, true);
                        });
                    }
                    else {
                        console.error('PagesManager not found');
                        this.sendErrorPage(500, req, res);
                    }

                    return true;
                }

                //-----------------------------------------------------------------

                const _this = this;
                this.pagesManager.renderToString(req.url).then(function(r)
                {
                    if(res._headerSent) {
                        res.writeHead(r.httpCode || 200, { 'Content-Type': 'text/html; charset=utf-8' });
                        res.end(r.html);
                    } else {
                        _this._helmet(req, res, function() {
                            res.writeHead(r.httpCode || 200, { 'Content-Type': 'text/html; charset=utf-8' });
                            res.end(r.html);
                        });
                    }
                })
                .catch(function(err)
                {
                    console.error(err);
                });
            }

            return true;
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