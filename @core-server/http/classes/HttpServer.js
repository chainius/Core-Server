'use strict';

process.options.secure = (process.options.secure === undefined) ? false : true;

const http          = process.options.secure ? require('spdy') : require('http');
const queryString   = require('querystring');
const cookie        = require('cookie');

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
    if(this._cookies)
        return this._cookies;

    var cookies = this.headers.cookie;
    if(!cookies) {
        this._cookies = {};
        return this._cookies;
    }

    var cookies = cookie.parse(cookies)
    for(var key in cookies) {
        var res = cookies[key];
        if (res.substr(0, 4) === 'enc:') {
            res = res.substr(4, res.length);
            res = Buffer.from(res, 'base64').toString();

            var j;
            var hexes = res.match(/.{1,4}/g) || [];
            res = "";
            for(j = 0; j<hexes.length; j++) {
                res += String.fromCharCode(parseInt(hexes[j], 16));
            }

            res = unescape(res);
            try {
                cookies[key] = JSON.parse(res);
            } catch(e) {
                cookies[key] = res;
            }
        }
    }

    this._cookies = cookies;
    return cookies
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
        
        this.openRequests   = [];
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
            }, this.handleRequest.bind(this));
        }
        else
        {
            this.server = http.createServer(this.handleRequest.bind(this));
        }

        //const threads = parseInt(process.options.threads) || ((process.env.NODE_ENV === 'production') ? require('os').cpus().length : 1);
        //if(threads === 1 && process.options.forceCluster === undefined) {
            const port = process.options.port || 8080;
            console.info('Starting server on port', port);
            this.server.listen(port);
        //}

        process.nextTick(function() { _this.setup(); })
        
        setInterval(() => {
            this.verifyTimeouts()
        }, 1000);
    }

    setup()
    {
        this.siteManager   = new (plugins.require('http/SiteManager'))(this);
        this.siteManager.server = this; //if someone did inherit the siteManager without sending the server instance to his super class, set the server manually
        const sockjs       = require('sockjs');

        this.echo = sockjs.createServer({
            log: function(){}
        });

        const pkg = require(process.cwd() + '/package.json')
        this.echo.installHandlers(this.server, this.sockjsConfig ? this.sockjsConfig() : { prefix: pkg['sockjs-prefix'] || '/socketapi', disable_cors: true });

        this.echo.on('connection', (conn) => {
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

        function onEnd() {
            try {
                req.rawBody = body;

                if(body.length === 0) {
                    req.body = {};
                    return next();
                }

                switch(req.headers['content-type'].toLowerCase().split(';')[0]) {
                    case 'application/x-www-form-urlencoded':
                        req.body = queryString.parse(body, undefined, undefined, {
                            maxKeys: 1000
                        });
                        break;
                    case 'application/json':
                        req.body = JSON.parse(body);
                        break;
                    case 'multipart/form-data':
                        console.warn('multipart/form-data post not supported');
                        /*var form = new formidable.IncomingForm();

                        form.parse(req, function(err, fields, files)
                        {
                            if(err)
                                next(err);

                            req.post = fields;
                            req.files = files;

                            next();
                        });*/
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
    
    verifyTimeouts() {
        const now = Date.now();
        const connections = this.openRequests;
        this.openRequests = [];
        
        for(var key in connections) {
            if(connections[key].res._headerSent || connections[key].res.ended || connections[key].res.finished)
                continue;
            
            if(connections[key].openTime < now - this.timeout) {
                this.sendErrorPage(524, connections[key].req, connections[key].res);
            }
            else {
                this.openRequests.push(connections[key]);
            }
        }
    }

    handleRequest(req, res)
    {
        try {
            req.getClientIp = parseRequestClientIp;
            req.__defineGetter__('cookies', parseRequestCookies.bind(req));

            this.openRequests.push({
                req: req,
                res: res,
                openTime: Date.now()
            });
            
            if(!this.siteManager) {
                res.writeHead(404, { 'Content-Type': 'text/html; charset=utf-8' });
                res.end('The requested resource could not be found');
                return;
            }

            if(this.siteManager.handle(req, res) === false) {
                res.writeHead(404, { 'Content-Type': 'text/html; charset=utf-8' });
                res.end('The requested resource could not be found');
            }
        } catch(e) {
            console.error(e);
            return this.sendErrorPage(500, req, res);
        }
    }

    handleSocket(socket, predata)
    {
        if (predata)
            socket.unshift(Buffer.from(predata, 'base64'));

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
            if (this.siteManager !== null && this.siteManager !== undefined)
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
            console.error(e);
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
    if(req.headers['x-forwarded-for'])
        return req.headers['x-forwarded-for'];

    if (socket)
        return socket.remoteAddress || '';
    if (req.connection)
        return req.connection.remoteAddress || '';

    return '';
};

module.exports = HttpServer;