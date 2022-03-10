const Sentry = require("@sentry/node")

class SiteManager extends SuperClass {

    getGraphqlContext(info) {
        const tx = Sentry.startTransaction({
            op:          "graphql",
            description: "graphql",
            name:        "graphql",
        })

        if(!tx)
            return super.getGraphqlContext(info)

        info.res.once('close', () => tx.finish())
        return super.getGraphqlContext(info).then((r) => {
            r.$sentryTransaction = tx
            const or = r.api

            r.api = (name, post) => {
                info.req.$sentryTransaction = tx
                return or(name, post)
            }

            return r
        })
    }

}

module.exports = SiteManager