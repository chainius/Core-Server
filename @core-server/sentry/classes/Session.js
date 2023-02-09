const Sentry = require("@sentry/node")
const pkg = require(process.cwd() + "/package.json")
// const Tracing = require("@sentry/tracing")

if(!pkg.sentry || (pkg.sentry.onlyProd && process.env.NODE_ENV != "production")) {
    module.exports = SuperClass
    return
}

console.log('Setting up sentry config')

if(!pkg.sentry.release)
    pkg.sentry.release = pkg.version

if(!pkg.sentry.environment)
    pkg.sentry.environment = process.env.SENTRY_ENV || process.env.NODE_ENV || 'development'

// pkg.sentry.integrations = pkg.sentry.integrations || [
//     new Tracing.Integrations.Mongo({
//         useMongoose: true // Default: false
//     })
// ]

var sentryConfig = JSON.parse(JSON.stringify(pkg.sentry));
delete sentryConfig.onlyProd
delete sentryConfig.tags
Sentry.init(sentryConfig)

/** session */
class Session extends SuperClass {

    __execApi(apiHandler, environment) {
        var transaction
        if(environment.$req.$sentryTransaction && !environment.$sentryTransaction) {
            transaction = environment.$req.$sentryTransaction.startChild({
                op:          "api",
                description: apiHandler.name,
            })
        } else if(!environment.$sentryTransaction) {
            transaction = Sentry.startTransaction({
                op:          "api",
                description: apiHandler.name,
                name:        apiHandler.name,
            })
        }
        
        if(!transaction)
            return super.__execApi(apiHandler, environment)

        environment.$sentryTransaction = transaction
        return super.__execApi(apiHandler, environment).finally(res => {
            transaction.finish()
            return res
        })
    }

    onException(e, info) {
        if(e.captured)
            return

        e.captured = true
        Sentry.withScope(scope => {
            if (typeof(pkg.sentry.tags) == "object") {
                for (var key in pkg.sentry.tags) {
                    scope.setTag(key, pkg.sentry.tags[key])
                }
            }

            if (info && info.name)
                scope.setTag('api', info.name)

            if (info && info.method)
                scope.setTag('method', info.method)
            else if (info && info.environment && info.environment.$req && info.environment.$req.method)
                scope.setTag('method', info.environment.$req.method)

            if (info && info.graphql)
                scope.setTag('graphql', info.graphql)                

            if (info && info.$sentryTransaction)
                scope.setSpan(info.$sentryTransaction)
            else if (info && info.environment && info.environment.$sentryTransaction)
                scope.setSpan(info.environment.$sentryTransaction)

            if (Array.isArray(e.context) || info.context) {
                for (var ctx of (e.context || info.context)) {
                    if (ctx.name && ctx.data)
                        scope.setContext(ctx.name, ctx.data)
                }
            }
          
            if (typeof(e.tags) == "object") {
                for (var key in e.tags) {
                    scope.setTag(key, e.tags[key])
                }
            }

            if(this.data && this.data.auth_id)
                scope.setUser({ id: this.data.auth_id })

            Sentry.captureException(e, scope)
        })
    }

}

module.exports = Session
