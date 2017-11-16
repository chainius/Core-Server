'use strict';

process.options.secure = (process.options.secure === undefined) ? false : true;

const express       = require('express');
const http          = process.options.secure ? require('spdy') : require('http');

/*const formidable    = require('formidable');

function formParse(req, res, next)
{
    if(req.method !== 'POST' || req.headers['content-type'] !== 'multipart/form-data')
        return next();

    var form = new formidable.IncomingForm();

    form.parse(req, function(err, fields, files)
    {
        if(err)
            next(err);

        req.post = fields;
        req.files = files;

        next();
    });
}*/

class HttpServer
{
    constructor(config)
    {
        this.config         = config || {};
        this.sockets        = [];
        this.app            = express();
        this.isWorker       = true;

        const _this = this;
        process.on('message', function(msg, socket) {
            _this.onWorkerMessage(msg, socket);
        });

        if(process.options.secure)
        {
            const Path  = require('path');
            const fs    = require('fs');
            const cwd   = process.cwd();

            this.server = http.createServer({
                key: fs.readFileSync(Path.join(cwd, 'ssl', 'key.pem')),
                cert: fs.readFileSync(Path.join(cwd, 'ssl', 'cert.pem')),

                spdy: {
                    protocols: [ 'h2', 'spdy/3.1', 'http/1.1' ],
                    plain: false
                }
            }, this.app);
        }
        else
        {
            this.server = http.createServer(this.app);
        }
        
        const threads = parseInt(process.options.threads) || ((process.env.NODE_ENV === 'production') ? require('os').cpus().length : 1);
        if(threads === 1 && process.options.forceCluster === undefined) {
            const port = process.options.port || 8080;
            console.info('Starting server on port', port);
            this.server.listen(port);
        }

        process.nextTick(function() { _this.setup(); })

        //----------------------------------------------------------------------------------------------------------------

        this.app.disable('x-powered-by');
        /*this.appUse(function(req, res, next)
        {
            req.localtime = Date.now();
            next();
        });*/
    }

    setup()
    {
        console.info('Setup http(s) server');
        this.siteManager   = new (plugins.require('web-server/SiteManager'))(this);

        const sockjs       = require('sockjs');
        const bodyParser   = require('body-parser');
        const cookieParser = require('cookie-parser');
        const methodOverride = require('method-override');
        const timeout      = require('connect-timeout');
        const cors         = require('cors');
        const helmet       = require('helmet');
        const _this        = this;

        this.echo = sockjs.createServer({ sockjs_url: 'https://cdn.jsdelivr.net/sockjs/1.1.4/sockjs.min.js',
            log: function(){}
        });

        this.echo.installHandlers(this.server, {prefix: '/socketapi'});

        const uploadLimit = '15mb';

        //this.appUse(timeout('5s', { respond: false }));
        //this.appUse(formParse);
        this.appUse(bodyParser.json({ limit: uploadLimit }));
        this.appUse(bodyParser.urlencoded({ extended: true, limit: uploadLimit })); //ToDo auto get limit from cloudflare
        this.appUse(timeout('5s', { respond: false }));

        this.appUse(cookieParser());
        this.appUse(helmet())
        this.appUse(cors());
        this.appUse(this.handleRequest, this);
        this.appUse(methodOverride());
        this.appUse(this.verifyTimeout, this);
        this.appUse(this.logError, this);
        this.appUse(this.handleError, this);

        this.echo.on('connection', function(conn)
        {
            _this.onSockJsConnect(conn);
        });
    }

    //---------------------------------------------------------------------------------------------------------

    onWorkerMessage(msg, socket)
    {
        try
        {
            if (typeof (msg) === 'array' || typeof (msg) === 'object')
            {
                if (msg[0] === 'socket')
                    this.handleSocket(socket, msg[1]);
            }
        }
        catch (e)
        {
            console.error(e);
        }
    }

    handleRequest(req, res, next)
    {
        /*console.info('HttpServer pretime: ' + (Date.now() - req.localtime));

        const start = Date.now();
        const _this = this;

        res.on('finish', function()
        {
            _console.info('Skyserver finish time: ' + (Date.now() - start));
        });*/

        try {
            const _this = this;
            req.on('timeout', function()
            {
                _this.verifyTimeout(null, req, res, null);
            });

            req.client_ip = HttpServer.getClientIpFromHeaders(req);

            if (this.siteManager === null)
                return this.sendErrorPage(404, req, res);

            this.siteManager.handle(req, res);
        } catch(e) {
            console.error(e);
            return this.sendErrorPage(500, req, res);
        }
    }

    handleSocket(socket, predata)
    {
        if (predata)
            socket.unshift(new Buffer(predata, 'base64'));

        this.server.emit('connection', socket);
        socket.resume();
    }

    close()
    {
        const cluster = require('cluster');

        if(cluster.isWorker) {
            require('cluster').worker.disconnect();
        } else {
            this.server.close();
        }
    }

    sendErrorPage(code, req, res)
    {
        try
        {
            if (this.siteManager !== null)
            {
                this.siteManager.sendErrorPage(code, req, res);
                return;
            }
        }
        catch (err)
        {
            console.error(err);
        }

        try
        {
            res.setHeader('Content-Type', 'text/html; charset=utf-8');
            res.status(code);
            res.send('An error occured on the server (code: ' + code + ')');
        }
        catch (err)
        {
            console.error(err);
        }
    }

    //---------------------------------------------------------------------------------------------------------

    verifyTimeout(err, req, res, next)
    {
        if (req.timedout)
        {
            console.error('An timeout occured on the page:', req.url);
            this.sendErrorPage(524, req, res);
        }
        else if (next)
        {
             next();
        }
    }

    logError(err, req, res, next)
    {
        console.error(err);
        next(err);
    }

    handleError(err, req, res, next)
    {
        console.error(err);
        this.sendErrorPage(500, req, res);
    }

    appUse(func, obj)
    {
        if (obj !== null)
        {
            this.app.use(function()
            {
                func.apply(obj, arguments);
            });
        }
        else

            this.app.use(func);
    }

    //---------------------------------------------------------------------------------------------------------

    onSockJsConnect(socket)
    {
        try
        {
            this.sockets.push(socket);
            const _this = this;

            socket.on('close', function()
            {
                const index = _this.sockets.indexOf(socket);
                if (index > -1)
                    _this.sockets.splice(index, 1);
            });

            if (this.siteManager === null)
            {
                socket.send('Host not found');
                socket.close();
                return;
            }

            this.siteManager.sessionsManager.handleSocket(socket);
        }
        catch (e)
        {
            logCatch(e);
        }
    }

    broadcastSocket(msg)
    {
        if (typeof (msg) === 'array' || typeof (msg) === 'object')
            msg = JSON.stringify(msg);

        for (var key in this.sockets)
        {
            try
            {
                this.sockets[key].write(msg);
            }
            catch (e)
            {
                console.error(e);
            }
        }
    }

}

HttpServer.getClientIpFromHeaders = function(req, socket)
{
    var address = '';

    try
    {
        if (socket)
            address = socket.remoteAddress || '';
        else if (req.connection)
            address = req.connection.remoteAddress || '';

        if (req.headers['cf-connecting-ip'])
            address = req.headers['cf-connecting-ip'];
        else if (req.headers['x-real-ip'])
            address = req.headers['x-real-ip'];
    }
    catch (e)
    {
        console.error('getClientIp', e);
    }

    return address;
};

module.exports = HttpServer;