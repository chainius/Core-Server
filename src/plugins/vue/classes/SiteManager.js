class SiteManager extends SuperClass {

    constructor(httpServer) {
        super(httpServer);

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
            const _this = this;

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

                this.pagesManager.getRenderStream(req).then(function(r)
                {
                    if(r.stream === null)
                    {
                        if(r.error !== null)
                        {
                            console.error(r.error);
                        }

                        res.writeHead(500, { 'Content-Type': 'text/html; charset=utf-8' });
                        res.end('An unexpected error occured, please check if the ui option is enabled and the bundle has successfully been generated');
                        return;
                    }

                    _this.pagesManager.handleVueStream(r.stream, r.ctx, req, res);
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