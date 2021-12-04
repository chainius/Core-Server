const { ApolloServer } = require('apollo-server-express')
const GraphDB = plugins.require('graphql/GraphDb')
const Session = plugins.require('api/Session')
const context = require('../lib/context')
const fs = require('fs')
const path = require('path')

/* const typeDefs = gql(`
  # Comments in GraphQL strings (such as this one) start with the hash (#) symbol.

  # This "Book" type defines the queryable fields for every book in our data source.
  type Book {
    title: String
    author: String
  }

  # The "Query" type is special: it lists all of the available queries that
  # clients can execute, along with the return type for each. In this
  # case, the "books" query returns an array of zero or more Books (defined above).
  type Query {
    books(id: ID!): Formula
  }
`);

console.log(JSON.stringify(typeDefs.definitions, null, 2))*/

class SiteManager extends SuperClass {

    async getGraphqlContext({ req }) {
        var sess = null

        // Try loading session from headers (parsed from LB)
        if(req.session) {
            sess = req.session
        } else if(req.headers.session) {
            if(this.getConfig('graphql').sessionHeaders) {
                try {
                    const data = JSON.parse(req.headers.session)
                    sess = new Session(this, '', {
                        localeOnly: true,
                        data,
                    })
                } catch(e) {
                    console.error('Could not load session', e.message)
                }
            }
        } else if(!this.getConfig('graphql').sessionHeaders) {
            sess = this.sessionsManager.getFromCookies(req.cookies)
            await sess.onReady()
        }

        // Create empty session if no session available

        if(sess == null) {
            sess = new Session(this, '', {
                localeOnly: true,
                data:       {},
            })
        }

        // Create context object
        var res = Object.assign({ permissions: sess.permissions }, sess.data)
        res.api = (name, post) => {
            return sess.api(name, post)
        }

        res.session_object = sess
        res.session = sess.data
        return res
    }

    autoSetupFromConfig() {
        super.autoSetupFromConfig()
        console.log('Setup graphql server')
    
        var config = this.getConfig('servers')
        if(config.mysql) {
            config = config.mysql
            const { schemas, resolvers, typeDefs } = GraphDB.construct(config.host || config.server, config.user || config.username, config.password || config.pass, config.database || config.db)
            context.Schemas = schemas
            context.SiteManager = this
            this.Sequelize = require('sequelize')

            if(fs.existsSync(path.join(process.cwd(), 'graphql', 'src', 'mixin.js'))) {
                const mixin = require(path.join(process.cwd(), 'graphql', 'src', 'mixin.js'))
                this.schemas= mixin(schemas, resolvers, typeDefs)
            } else {
                this.schemas = schemas
            }

            if(typeDefs.definitions[0].fields.length == 0)
                return

            this.apollo = new ApolloServer({
                typeDefs,
                resolvers,
                context: this.getGraphqlContext.bind(this)
            })

            this.apollo.applyMiddleware({
                app:  this,
                path: this.getConfig('servers').graphqlEndpoint || '/graphql'
            })
        }
    }
}

module.exports = SiteManager