const redis = require('redis')

class Redis {
    constructor(config) {
        this.config = config
        this.connect()
        this.subscriptions = []
        this.channelCallbacks = []
    }

    connect() {
        try {
            var _this = this
            this.link = redis.createClient(this.config)
            console.success('Connected to the redis server')

            this.link.on('error', function(e) {
                console.error(e)
            })

            this.link.on('warning', function(e) {
                console.warn(e)
            })

            /* this.link.on('subscribe',function(msg)
            {
                console.log("Subscription request:", msg)
            });*/

            this.link.on('message', function(channel, message) {
                try {
                    message = JSON.parse(message)
                    for (var key in _this.channelCallbacks) {
                        if (_this.channelCallbacks[key].channel === channel) {
                            try {
                                _this.channelCallbacks[key].cb(message)
                            } catch (e) {
                                console.error(e)
                            }
                        }
                    }
                } catch (e) {
                    console.error(e)
                }
            })
        } catch (e) {
            this.link = false
            console.error(e)
        }
    }

    onChannel(channel, cb) {
        try {
            this.channelCallbacks.push({ channel: channel, cb: cb })
            this.subscriptions.push(channel)
            this.link.subscribe(channel)
        } catch (e) {
            console.error(e)
        }
    }

    subscribe(channel) {
        try {
            var index = this.subscriptions.indexOf(channel)
            if (index === -1)
                return

            this.subscriptions.splice(index, 1)
            this.link.unsubscribe(channel)
        } catch (e) {
            console.error(e)
        }
    }

    hasSubscribed(channel) {
        return (this.subscriptions.indexOf(channel) !== -1)
    }

    tryCloseLink(link) {
        try {
            return link.quit()
        } catch (e) {
            return false
        }
    }

    emit(channel, msg) {
        var link = null

        try {
            link = this.link.duplicate()
            link.publish(channel, JSON.stringify(msg))
            link.quit()
        } catch (e) {
            if (link)
                this.tryCloseLink(link)

            console.error(e)
        }
    }

    save(token, data, expirationTime) {
        var link = null

        try {
            link = this.link.duplicate()
            link.set(token, JSON.stringify(data))

            if (expirationTime)

                link.send_command('PEXPIREAT', [token, expirationTime])

            link.quit()
        } catch (e) {
            if (link)
                this.tryCloseLink(link)

            console.error(e)
        }
    }

    load(token) {
        var _this = this
        return new Promise(function(resolve, reject) {
            var link = null

            try {
                link = _this.link.duplicate()
                link.get(token, function(err, reply) {
                    _this.tryCloseLink(link)

                    if (err)
                        return reject(err)

                    if (reply === null)
                        return reject('Token does not exists on redis')

                    try {
                        resolve(JSON.parse(reply.toString()))
                    } catch (e) {
                        reject(e)
                    }
                })
            } catch (e) {
                if (link)
                    _this.tryCloseLink(link)

                reject(e)
            }
        })
    }

    getExpirationTime(token, defaultExpiration) {
        var _this = this
        return new Promise(function(resolve, reject) {
            var link = _this.link.duplicate()
            link.send_command('PTTL', [token], function(err, resp) {
                link.quit()

                if (err)
                    resolve(defaultExpiration)
                else
                    resolve(Date.now() + resp)
            })
        })
    }
}

module.exports = Redis