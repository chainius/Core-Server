const { ApolloServer } = require('apollo-server-express');
const GraphDB          = plugins.require('graphql/GraphDb')
const Session          = plugins.require('api/Session');
const context          = require('../lib/context')

/*const typeDefs = gql(`
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
    constructor(server) {
        super(server)

      console.log('setup graphql server')

      var config = this.getConfig('servers')
      if(config.mysql) {
        config = config.mysql;
        const { schemas, resolvers, typeDefs } = GraphDB.construct(config.host, config.user, config.password || config.pass, config.database || config.db)
        this.schemas    = schemas
        context.Schemas = schemas

        if(typeDefs.definitions[0].fields.length == 0)
          return

        this.apollo = new ApolloServer({
            typeDefs,
            resolvers,
            context: ({ req }) => {
              var sess = null;

              // Try loading session from headers (parsed from LB)
              if(req.headers.session) {
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

              // Create empty session if no session available
              if(sess == null) {
                sess = new Session(this, '', {
                  localeOnly: true,
                  data: {},
                })
              }

              // Create context object
              var res = Object.assign({}, sess.data)
              res.api = (name, post) => {
                return sess.api(name, post)
              }

              return res
            }
        });

        this.apollo.applyMiddleware({
            app: this,
            path: '/graphql'
        });
      }
    }
}

module.exports = SiteManager