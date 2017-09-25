const Path  = require('path');

class SiteManager extends SuperClass {

    /**
    * Handle a tsv request
    * @param req {Object}
    * @param res {Object}
    */
    handleTsv(req, res, offset)
    {
        if(!this.tsvSqls)
            this.tsvSqls = [];

        this.connections = this.connections || {};

        try
        {
            const d3Tsv = require('d3-dsv');

            if (Path.extname(req.url) !== '.tsv' || !this.connections.mysql)
                return this.sendErrorPage(404, req, res);

            const _this = this;
            if (offset === undefined)
                offset = 0;

            var fullpath = req.url.substr(1 + offset);
            fullpath = fullpath.substr(0, fullpath.length - 4).split('/');

            if (!this.tsvSqls[fullpath[0]])
            {
                const fs = require('fs');
                const cacheObject = pluginq.require('web-server/Resources/CacheObject');
                const obj         = new cacheObject('text/tab-separated-values', Path.join(process.cwd(), 'resoures', 'tsv', fullpath[0] + '.sql'));

                obj.setLoader(function(resolve, reject, path)
                {
                    fs.readFile(path, 'utf8', function(err, data)
                    {
                        if (err)
                            reject(err);
                        else
                            resolve(data);
                    });
                });

                this.tsvSqls[fullpath[0]] = obj;
            }

            this.tsvSqls[fullpath[0]].onLoadOnce(function(err, content, mime)
            {
                if (err)
                    return _this.sendErrorPage(404, req, res);

                _this.connections.mysql.queryWithFields(content, fullpath).then(function(d)
                {
                    res.setHeader('Content-Type', mime);

                    if (d.result.length == 1 && d.fields.length == 1)
                    {
                        var val = d.result[0][d.fields[0].name];
                        if (typeof (val) === 'object' || typeof (val) === 'array')
                            return res.send(d3Tsv.tsvFormat(val));
                    }

                    res.send(d3Tsv.tsvFormat(d.result));
                })
                .catch(function(err)
                {
                    console.error(err);
                    _this.sendErrorPage(500, req, res);
                });
            });
        }
        catch (e)
        {
            console.error(e);
            this.sendErrorPage(500, req, res);
        }

        return this;
    }

    preHandle(req, res, prePath)
    {
        if(prePath !== 'tsv')
            return super.preHandle(req, res, prePath);

        this.handleTsv(req, res, 4);
        return true;
    }

}

module.exports = SiteManager;