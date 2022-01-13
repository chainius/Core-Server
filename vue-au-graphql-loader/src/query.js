import { withFragments } from './fragments'

export default function create_query(handler, attributes, query, fragments) {
    var self = this
    var stream;

    // Query execution function
    var execute = () => {
        // Create a stream object to assign results to component
        stream = {
            emit(data) {
                updating = false

                // Assign result to component fields
                for(var selection of query.selectionSet.selections) {
                    var key = selection.alias && selection.alias.value || selection.name.value
                    if(data[key] !== undefined)
                        self[key] = data[key]
                }

                // Call graphql hooks
                if(self.$options.graphql) {
                    if(self.$options.graphql.success)
                        self.$options.graphql.success.call(self, data)
                    if(self.$options.graphql.done)
                        self.$options.graphql.done.call(self)
                }
            },
    
            error(err) {
                updating = false

                // Call graphql hooks
                if(self.$options.graphql) {
                    if(self.$options.graphql.error)
                        self.$options.graphql.error.call(self, err)
                    if(self.$options.graphql.done)
                        self.$options.graphql.done.call(self)
                }
            }
        }

        try {
            // Call query on handler
            var res = handler({
                query: withFragments(query, fragments),
                variables: query.variables(this),
                attributes,
                stream,
                component: this,
            })
    
            // Send handler result to data stream
            if(!res || res == stream) {
                updating = false
                return
            } else if(res.then) {
                res.then(stream.emit).catch(stream.error)
            } else {
                stream.emit(res)
            }
        } catch(e) {
            updating = false
            stream.error(e)
        }
    }

    // Execute query
    execute()

    // Return object to be able to update on variable change or close stream on component destroyed
    var updating = false
    return {
        update() {
            // Dependency variable updated, update query on next tick
            if(updating)
                return

            updating = true
            self.$nextTick(() => {
                if(stream.close)
                    stream.close()

                execute()
            })
        },
        close() {
            if(stream.close)
                stream.close()
        }
    }
}