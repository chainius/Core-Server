'use strict';

process.options.secure = (process.options.secure === undefined) ? false : true;

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

function cachedProperty(object, name, calculator) {
    var value = null;

    Object.defineProperty(object, name, {
        get: function() {
            if(value !== null)
                return value;

            value = calculator(object);
            return value;
        },

        set: function(nValue) {
            value = nValue;
        }
    });
}

function emptyFn() {}

//--------------------------------------------------------------------

const cookie = require('cookie')

//------------------------------------------------------------------------

class HttpServer
{
    constructor(config)
    {
        this.config         = config || {};
        this.sockets        = [];
        this.isWorker       = true;
        this.timeout        = 10000; //10 secondes
        
        this.createCachedProperty = cachedProperty;

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
            this.server = http.createServer(this.handleRequest.bind(this));
        }
        
        const threads = parseInt(process.options.threads) || ((process.env.NODE_ENV === 'production') ? require('os').cpus().length : 1);
        if(threads === 1 && process.options.forceCluster === undefined) {
            const port = process.options.port || 8080;
            console.info('Starting server on port', port);
            this.server.listen(port);
        }

        process.nextTick(function() { _this.setup(); })
    }

    setup()
    {
        console.info('Setup http(s) server');
        this.siteManager   = new (plugins.require('web-server/SiteManager'))(this);

        const sockjs       = require('sockjs');

        this.echo = sockjs.createServer({ sockjs_url: 'https://cdn.jsdelivr.net/sockjs/1.1.4/sockjs.min.js',
            log: function(){}
        });
        
        this.echo.installHandlers(this.server, {prefix: '/socketapi'});
        
        const bodyParser   = require('body-parser');
        const uploadLimit  = '15mb';
        
        this.postParsers = {
            json: bodyParser.json({ limit: uploadLimit }),
            url:  bodyParser.urlencoded({ extended: true, limit: uploadLimit })
        };

        /*const cors         = require('cors');
        const helmet       = require('helmet');

        this.appUse(helmet())
        this.appUse(cors());
        //this.appUse(this.handleRequest, this);
        /*this.appUse(methodOverride());*/

        this.echo.on('connection', (conn) =>
        {
            this.onSockJsConnect(conn);
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

    parseBody(req, res, next) {
        this.postParsers.json(req, res, () => {
            this.postParsers.url(req, res, next);
        });
    }
    
    handleRequest(req, res)
    {
        try {
            cachedProperty(req, 'client_ip', HttpServer.getClientIpFromHeaders);

            cachedProperty(req, 'cookies', function() {
                const cookies = req.headers.cookie;
                if(!cookies)
                    return {};

                return cookie.parse(cookies)
            });

            this.siteManager.handle(req, res);
            
            //Setup timeout
            if(res._headerSent)
                return;

            const id = setTimeout(() => {
                req.timedout = true;
                console.error('An timeout occured on the page:', req.url);
                this.sendErrorPage(524, req, res);
            }, this.timeout);
            
            var onFinished = require('on-finished')
            var onHeaders = require('on-headers')
            
            onFinished(res, function () {
                clearTimeout(id)
            })

            onHeaders(res, function () {
                clearTimeout(id)
            });
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
            res.writeHead(code, { 'Content-Type': 'text/html; charset=utf-8' });
            res.end('An error occured on the server (code: ' + code + ')');
        }
        catch (err)
        {
            console.error(err);
        }
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
    if (req.headers['cf-connecting-ip'])
        return req.headers['cf-connecting-ip'];
    if (req.headers['x-real-ip'])
        return req.headers['x-real-ip'];
    
    if (socket)
        return socket.remoteAddress || '';
    if (req.connection)
        return req.connection.remoteAddress || '';
    
    return '';
};

module.exports = HttpServer;