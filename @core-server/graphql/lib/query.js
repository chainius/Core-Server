const { convertNodeHttpToRequest, runHttpQuery } = require('apollo-server-core')
const Crypter = plugins.require('http/Crypter')

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

    async doQuery(socket, session, initialState) {
        // Execute graphql query
        const { apollo } = session.siteManager
        const req = {
            session,
            method: 'GET',
            headers: socket.headers,
        }

        // Execute query
        var res = ""
        var etag = ""

        await runHttpQuery([ req ], {
            method: "GET",
            options: apollo.graphQLServerOptions({ req }),
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

            if(res.code == 401 && this.siteManager.addLog)
                this.siteManager.addLog('graphql', socket, session, this.apolloQuery, res)

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

        // Send result back
        return session.sendSocketMessage(socket, res)
    }

    handle(socket, session, initialState) {
	    // Handle simple query
        if(this.Query != "" && this.query)
            this.doQuery(socket, session, initialState).catch(console.error)

        // Handle bulk queries
        if(this.bulk) {
            for(var key in this.bulk) {
                if(!(this.bulk[key] instanceof WSRequest)) {
                    this.bulk[key] = new WSRequest(this.bulk[key])
                    this.bulk[key].live = null
                    this.bulk[key].bulk = []
                }

                this.bulk[key].handle(socket, session, initialState)
            }
        }
    }

    removeSubQueries() {
        for(var key in this.bulk) {
            this.bulk[key].bulk = []
            this.bulk[key].live = null
        }

        this.live = null
    }

}

// --------------------------

module.exports = function WebSocket(session, socket, message) {
    // Verify if query present
	if(!message.query && !message.live && !message.bulk)
        return

    message = new WSRequest(message)
    message.handle(socket, session, true)

    // Handle subscriptions
    if(message.live) {

        message.live = new WSRequest(message.live)
        message.live.removeSubQueries()
        message.live.handle(socket, session, true)

        // console.warn("handle", socket.id, typeof(socket.$liveGraphql), JSON.stringify(message, null, 4))
        socket.$liveGraphql = message.live

        if(!socket.$liveGraphqlInterval) {
            socket.$liveGraphqlInterval = setInterval(() => {
                if(socket.$liveGraphql) {
                    socket.$liveGraphql.handle(socket, session, false)
                } else {
                    clearInterval(socket.$liveGraphqlInterval)
                    delete socket.$liveGraphqlInterval
                }
            }, session.siteManager.graphqlLiveInterval || 200)

            socket.once('close', () => {
                clearInterval(socket.$liveGraphqlInterval)
                delete socket.$liveGraphqlInterval
            })
        }

    } else if(message.live === null) {
        clearInterval(socket.$liveGraphqlInterval)
    }
}