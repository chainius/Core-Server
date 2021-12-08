const Sentry = require("@sentry/node")
const pkg = require(process.cwd() + "/package.json")

if(!pkg.sentry || (pkg.sentry.onlyProd && process.env.NODE_ENV != "production")) {
    module.exports = SuperClass
    return
}

console.log('Setting up sentry config')

if(!pkg.sentry.release)
    pkg.sentry.release = pkg.version

if(!pkg.sentry.environment)
    pkg.sentry.environment = process.env.SENTRY_ENV || process.env.NODE_ENV || 'development'

delete pkg.sentry.onlyProd
Sentry.init(pkg.sentry)

/** session */
class Session extends SuperClass {

    // api(name, post, req = {}) {
    //     const transaction = Sentry.startTransaction({
    //         op: "api",
    //         name,
    //     })

    //     req.$sentryTransaction = transaction
    //     return super.api.call(this, name, post, req).finally(res => {
    //         transaction.finish()
    //         return res
    //     })
    // }

    __execApi(apiHandler, environment) {
        const transaction = Sentry.startTransaction({
            op:   "api",
            name: apiHandler.name,
        })

        environment.$sentryTransaction = transaction
        return super.__execApi(apiHandler, environment).finally(res => {
            transaction.finish()
            return res
        })
    }

    onException(e, info) {
        Sentry.withScope(scope => {
            if(info && info.name)
                scope.setTag('api', info.name)

            if(info && info.$sentryTransaction)
                scope.setSpan(info.$sentryTransaction)
            else if(info && info.environment.$sentryTransaction)
                scope.setSpan(info.environment.$sentryTransaction)

            if(Array.isArray(e.context)) {
                for(var ctx of e.context) {
                    if(ctx.name && ctx.data)
                        scope.setContext(ctx.name, ctx.data)
                }
            }

            if(this.data && this.data.auth_id)
                scope.setUser({ id: this.data.auth_id })

            Sentry.captureException(e)
        })
    }

}

module.exports = Session