const Sentry = require("@sentry/node")

class GraphDB extends SuperClass {

    withResolver(resolver, name) {
        return function(parent, args, context, info) {
            var transaction;
            if(context.$sentryTransaction) {
                transaction = context.$sentryTransaction.startChild({
                    op:   "resolve",
                    description: name,
                })
            } else {
                transaction = Sentry.startTransaction({
                    op: "graphql",
                    description: name,
                    name: name,
                })
            }
    
            return resolver.call(this, parent, args, Object.assign({
                $sentryTransaction: transaction,
            }, context), info).finally(() => {
                transaction.finish()
            })
        }
    }

}

module.exports = GraphDB