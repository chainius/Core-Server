'use strict';

process.options.secure = (process.options.secure === undefined) ? false : true;

const http          = process.options.secure ? require('spdy') : require('http');
const queryString   = require('querystring');
const cookie        = require('cookie');

const onFinished    = require('on-finished')
const onHeaders     = require('on-headers')

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

            value = calculator.call(object, object);
            return value;
        },

        set: function(nValue) {
            value = nValue;
        }
    });
}

function parseRequestCookies() {
    const cookies = this.headers.cookie;
    if(!cookies)
        return {};

    return cookie.parse(cookies)
}

function parseRequestClientIp() {
    return HttpServer.getClientIpFromHeaders(this);
}

//------------------------------------------------------------------------

class HttpServer
{
    constructor(config)
    {
        this.config         = config || {};
        this.sockets        = [];
        this.isWorker       = true;
        this.timeout        = 10000; //10 secondes
        this.uploadLimit    = 15 * 1024 * 1024;
        
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
        if(!req.headers['content-type'] || (!req.headers['transfer-encoding'] && isNaN(req.headers['content-length']))) {
            req.body = {};
            return next();
        }

        var body = '';
        const uploadLimit = this.uploadLimit;
        
        function onEnd() {
            try {
                if(body.length === 0) {
                    req.body = {};
                    return next();
                }

                switch(req.headers['content-type'].toLowerCase()) {
                    case 'application/x-www-form-urlencoded':
                        req.body = queryString.parse(body, undefined, undefined, {
                            maxKeys: 1000
                        });
                        break;
                    case 'application/json':
                        req.body = JSON.parse(body);
                        break;
                }

                next()
            } catch(e) {
                console.error(e);
                next();
            }
        }

        function onData(data) {
            try {
                body += data;

                if(body.length >= uploadLimit)
                {
                    req.removeEventListener('data', onData);
                    req.removeEventListener('end', onEnd);
                    onEnd();
                }
            } catch(e) {
                console.error(e);
                next();
            }
        }

        req.on('data', onData);
        req.on('end', onEnd);
    }
    
    handleRequest(req, res)
    {   
        try {
            req.getClientIp = parseRequestClientIp;
            req.__defineGetter__('cookies', parseRequestCookies);

            this.siteManager.handle(req, res);

            //Setup timeout
            if(res._headerSent)
                return;

            const id = setTimeout(() => {
                req.timedout = true;
                console.error('An timeout occured on the page:', req.url);
                this.sendErrorPage(524, req, res);
            }, this.timeout);

            function onDone() {
                clearTimeout(id)
            }

            onFinished(res, onDone);
            onHeaders(res, onDone);
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