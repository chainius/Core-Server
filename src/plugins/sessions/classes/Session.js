/** session */
class Session
{
    /**
    * @param siteManager {Class}
    * @param token {String}
    */
    constructor(siteManager, token)
    {
        this.expirationTime = Date.now() + (24 * 60 * 60 * 1000);
        this.siteManager    = siteManager;
        this.token          = token;
        this.activeSockets  = [];
        this.cookies        = {};
        this.data           = {};
        this.updateTime     = 0;
        this.ready          = true;
    }

    onReady()
    {
        this.ready = true;
        return true;
    }

    executeOnReady(fn) { //Async fn as input
        if(this.ready)
            return fn();
        
        const onR = this.onReady();
        
        if(!onR.then)
            return fn();
        
        return new Promise((resolve, reject) => {
            onR.then(function() {
                fn().then(function(result) {
                    resolve(result);
                }).catch(function(err) {
                    reject(err);
                });
            }).catch(function(err) {
                reject(err);
            });
        })
    }

    updateCookies(cookies)
    {
        if (typeof (cookies) === 'object')
            this.cookies = cookies;
    }

    setData(data) {
        for (var key in data)
        {
            this.data[key] = data[key];
        }
    }

    //------------------------------------------

    /**
    * Broadcast a message to all the connected sockets
    * @param message (String)
    */
    broadcastSocketMessage(message)
    {
        for (var key in this.activeSockets)
            this.sendSocketMessage(this.activeSockets[key], message);
    }

    /**
    * Send a message to a specific socket
    * @param message (String|Object|Array)
    */
    sendSocketMessage(socket, message)
    {
        try
        {
            if (typeof (message) === 'object' || typeof (message) === 'array')
                message = JSON.stringify(message);

            socket.write(message);
        }
        catch (e)
        {
            console.error(e);
        }
    }

    handleSocketMessage(socket, message)
    {
        if (message.event)
        {
            if (message.event === 'logout')
                this.data = {};
        }
    }

    handleSocketClose(socket)
    {
        try
        {
            const index = this.activeSockets.indexOf(socket);

            if (index !== -1)
                this.activeSockets.splice(index, 1);
        }
        catch (e)
        {
            console.error(e);
        }
    }

    handleSocket(socket)
    {
        this.activeSockets.push(socket);
        const _this = this;

        socket.on('data', function(message)
        {
            try
            {
                message = JSON.parse(message);
                _this.handleSocketMessage(socket, message);
            }
            catch(e) {
                console.error(e);
                _this.sendSocketMessage(socket, { error: 'HandleSocket error', message: e.message });
            }
        });

        socket.on('close', function()
        {
            _this.handleSocketClose(socket);
        });
    }
}

module.exports = Session;