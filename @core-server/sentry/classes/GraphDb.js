const Sentry = require("@sentry/node")

class GraphDB extends SuperClass {

    withResolver(resolver, name) {
        const fn = function(parent, args, context, info) {
            var transaction
            if(context.$sentryTransaction) {
                transaction = context.$sentryTransaction.startChild({
                    op:          "resolve",
                    description: name,
                })
            } else {
                transaction = Sentry.startTransaction({
                    op:          "graphql",
                    description: name,
                    name:        name,
                })
            }

            return resolver.call(this, parent, args, Object.assign({
                $sentryTransaction: transaction,
            }, context), info).catch((e) => {
                if(e.stack && e.message && context.session_object && context.session_object.onException) {
                    try {
                        context.session_object.onException(e, {
                            graphql:            name,
                            $sentryTransaction: transaction,
                            context:            [
                                {
                                    name: 'args',
                                    data: args,
                                }
                            ]
                        })
                    } catch(e) {
                        console.error(e)
                    }
                }

                throw(e)
            }).finally(() => {
                transaction.finish()
            })
        }

        for(var key in resolver)
            fn[key] = resolver[key]

        return fn
    }

}

module.exports = GraphDB