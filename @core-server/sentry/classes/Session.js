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

    onException(e, apiHandler) {
        Sentry.withScope(scope => {
            scope.setTag('api', apiHandler.name)

            if(this.data && this.data.auth_id)
                scope.setUser({ id: this.data.auth_id })

            Sentry.captureException(e)
        })
    }

}

module.exports = Session