const { convertNodeHttpToRequest, runHttpQuery } = require('apollo-server-core')
const Crypter = plugins.require('http/Crypter')
const EventEmitter = require('events')
const WebSocket = require('ws')

// Incomming WebSocket message (defining a graphql request)

class WSRequest {

    // Properties

    bulk    = []
    id      = undefined
    live	= null // WSRequest
    etag    = ""
    query   = ""
    operationName = ""
    variables     = {}

    // Methods

    constructor(props) {
        Object.assign(this, props)
        if(typeof(this.id) !== "string" && this.id !== undefined)
            throw('Wrong id provided')
        if(typeof(this.query) !== "string")
            throw('Wrong query provided')
        if(typeof(this.etag) !== "string")
            throw('Wrong etag provided')
        if(typeof(this.operationName) !== "string")
            throw('Wrong operationName provided')
        if(!Array.isArray(this.bulk) && this.bulk)
            throw('Wrong bulk provided')
    }

    get apolloQuery() {
        const r =  { query: this.query, variables: this.variables }
        if(this.operationName)
            r.operationName = this.operationName

        return r
    }

    async doQuery(socket, session, initialState, watcher) {
        if(this.watcher && this.watcher.unsubscribe && this.watcher.group && this.watcher.group != socket.id) {
            this.watcher.unsubscribe()
            this.watcher.group = socket.id
            delete this.watcher.unsubscribe
        }

        // Execute graphql query
        const { apollo } = session.siteManager
        const req = {
            session,
            method: 'GET',
            headers: socket.headers,
            socket,
            watcher,
        }

        // Execute query
        var res = ""
        var etag = ""

        const resEmitter = new EventEmitter();

        await runHttpQuery([ req ], {
            method: "GET",
            options: apollo.graphQLServerOptions({ req, res: resEmitter }),
            query: this.apolloQuery,
            request: convertNodeHttpToRequest(req),
        })
        .then((o) => {
            etag = Crypter.sha1(o.graphqlResponse)
            res = JSON.parse(o.graphqlResponse)
            if(res.errors) {
                for(var key in res.errors) {
                    if(res.errors[key].extensions)
                        delete res.errors[key].extensions.exception
                    if(res.errors[key].extensions.code == 'UNAUTHENTICATED') {
                        res.code = 401
                    }
                }

                etag = Crypter.sha1(JSON.stringify(res))
            }

            res.etag = etag
            if(this.id)
                res.id = this.id

            if(res.code == 401 && session.siteManager && session.siteManager.addLog)
                session.siteManager.addLog('graphql', socket, session, this.apolloQuery, res)

            res = JSON.stringify(res)
        }).catch((err) => {
            if(err.isGraphQLError)
                err = err.message

            if(typeof(err) === 'string') {
                try {
                    err = JSON.parse(err)
                } catch(e) {
                    err = { message: err }
                }
            }

            if(err.message) {
                err = {
                    errors: [ err.message ]
                }
            } else if(err.error) {
                err = {
                    errors: [ err.message ]
                }
            }

            if(err.errors) {
                for(var key in err.errors) {
                    if(err.errors[key].extensions)
                        delete err.errors[key].extensions.exception
                }
            }

            etag = Crypter.sha1(JSON.stringify(err))
            if(this.id)
                err.id = this.id

            err.etag = etag
            res = JSON.stringify(err)
        })

        // Handle etag
        if(this.etag !== etag) {
            this.etag = etag
        } else if(!initialState) {
            return
        } else {
            res = {
                data: null,
                unchanged: true,
                id: this.id,
            }
        }

        resEmitter.emit('close', res)

        // Send result back
        return session.sendSocketMessage(socket, res)
    }

    async handle(socket, session, initialState, watcher = false) {
        const upperWatcher = watcher
        if(watcher && initialState && watcher.subscribe) {
            this.watcher = {
                topics: [],
            }

            watcher = {
                disable: () => {
                    delete this.watcher
                },
                subscribe: (topics) => {
                    if(!Array.isArray(topics))
                        topics = [ topics ]

                    for(var topic of topics) {
                        topic.callback = topic.callback || this.onUpdated.bind(this, socket, session, initialState, watcher)
                    }

                    this.watcher.topics = this.watcher.topics.concat(topics)
                    // console.log('sub received', this.watcher.topics)
                    return () => {
                        this.watcher.topics = this.watcher.topics.filter(t => !topics.find((r) => r.uuid == t.uuid))
                    }
                }
            }
        }

        var queries = []

	    // Handle simple query
        if(this.Query != "" && this.query && (initialState || !this.watcher)) {
            const res = this.doQuery(socket, session, initialState, watcher).catch((e) => {
                console.error(e)
                if(session.onException)
                    session.onException(e)
            })

            queries.push(res)
        }

        // Handle bulk queries
        if(this.bulk) {
            for(var key in this.bulk) {
                if(!(this.bulk[key] instanceof WSRequest)) {
                    this.bulk[key] = new WSRequest(this.bulk[key])
                    this.bulk[key].live = null
                    this.bulk[key].bulk = []
                    this.bulk[key].watcher = this
                }

                const res = this.bulk[key].handle(socket, session, initialState, watcher)
                queries.push(res)
            }
        }

        await Promise.all(queries)

        // Subscribe to live queries
        if(initialState) {
            if(this.watcher && this.watcher.topics.length > 0) {
                // console.log('send', this.watcher.topics)
                this.watcher.unsubscribe = upperWatcher.subscribe(this.watcher.topics, {
                    group: socket.id,
                })
            } else {
                if(this.watcher && this.watcher.unsubscribe)
                    this.watcher.unsubscribe()
    
                delete this.watcher
            }
        }
    }

    onUpdated(socket, session, initialState, watcher) {
        if(socket.readyState == WebSocket.CLOSED) {
            if(this.watcher && this.watcher.unsubscribe)
                this.watcher.unsubscribe()

            if(watcher && watcher._groups && watcher._groups[socket.id]) {
                watcher.unsubscribe(watcher._groups[socket.id])
                delete watcher._groups[socket.id]
            }

            return
        }

        this.doQuery(socket, session, initialState).catch((e) => {
            console.error(e)
            if(session && session.onException)
                session.onException(e)
        })
    }

    queriesCount() {
        var count = 0
        if(this.Query != "" && this.query)
            count++

        // Handle bulk queries
        if(this.bulk) {
            for(var key in this.bulk) {
                if(!(this.bulk[key] instanceof WSRequest)) {
                    this.bulk[key] = new WSRequest(this.bulk[key])
                    this.bulk[key].live = null
                    this.bulk[key].bulk = []
                }

                count += this.bulk[key].queriesCount()
            }
        }

        return count
    }

    assertMaxQueries(max) {
        const count = this.queriesCount()
        if(count <= max)
            return

        const err = new Error('Too many graphql queries')
        err.context = [
            {
                name: 'counter',
                data: {
                    count,
                    max,
                }
            },
        ]

        throw(err)
    }

    removeSubQueries() {
        for(var key in this.bulk) {
            this.bulk[key].bulk = []
            this.bulk[key].live = null
        }

        this.live = null

        if(this.bulk && this.bulk.length > 0 && this.Query != "" && this.query)
            throw('invalid mix of bulk and query usage')
    }

}

// --------------------------

module.exports = function WebSocket(session, socket, message, watcher) {
    // Verify if query present
	if(!message.query && !message.live && !message.bulk)
        return

    const max = session.max_graphql_queries || 10
    message = new WSRequest(message)
    message.assertMaxQueries(max)
    message.handle(socket, session, true)

    // Handle subscriptions
    if(message.live) {

        message.live = new WSRequest(message.live)
        message.live.removeSubQueries()
        message.live.assertMaxQueries(max)
        message.live.handle(socket, session, true, watcher)

        // console.warn("handle", socket.id, typeof(socket.$liveGraphql), JSON.stringify(message, null, 4))
        socket.$liveGraphql = message.live

        if(!socket.$liveGraphqlInterval) {
            socket.$liveGraphqlInterval = setInterval(() => {
                if(socket.$liveGraphql) {
                    socket.$liveGraphql.handle(socket, session, false, watcher)
                } else {
                    clearInterval(socket.$liveGraphqlInterval)
                    delete socket.$liveGraphqlInterval
                }
            }, session.siteManager.graphqlLiveInterval || 200)

            socket.once('close', () => {
                clearInterval(socket.$liveGraphqlInterval)
                delete socket.$liveGraphqlInterval

                if(watcher && watcher._groups && watcher._groups[socket.id]) {
                    watcher.unsubscribe(watcher._groups[socket.id])
                    delete watcher._groups[socket.id]
                }
            })
        }

    } else if(message.live === null) {
        clearInterval(socket.$liveGraphqlInterval)
    }
}