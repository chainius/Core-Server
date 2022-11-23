import { withFragments } from './fragments'
import { ref, watchEffect } from 'vue'

function exec(cb, self, data) {
    if(typeof cb === 'function')
        return cb.call(self, data)

    if(Array.isArray(cb)) {
        for(var i = 0; i < cb.length; i++)
            exec(cb[i], self, data)
    }

    return cb
}

function initial_data(document) {
    var vars = document.selectionSet.selections.map((o) => o.alias && o.alias.value || o.name.value)
    var res = {}
    for(var key of vars)
        res[key] = ref(null)

    return res
}

export default function create_query(data, handler, attributes, query, fragments) {
    var self = this
    var current_data = initial_data(query)
    var stream
    var catchers = []

    // Query execution function
    var execute = () => {
        // Create a stream object to assign results to component
        stream = {
            emit(data) {
                updating = false

                // Assign result to component fields
                for(var selection of query.selectionSet.selections) {
                    var key = selection.alias && selection.alias.value || selection.name.value
                    if(data[key] !== undefined) {
                        current_data[key].value = data[key]
                    }
                }

                // Call graphql hooks
                exec(self.$options.graphql?.success, self, data)
                exec(self.$options.graphql?.done, self)
            },
    
            error(err) {
                updating = false

                // Call graphql hooks
                exec(self.$options.graphql?.error, self, err)
                exec(catchers, self, err)
                exec(self.$options.graphql?.done, self)
            }
        }

        try {
            // Call query on handler
            var res = handler({
                query:     withFragments(query, fragments),
                variables: query.variables(data),
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
    var updating = false
    const stop_watcher = watchEffect(() => {
        if(updating)
            return
 
        updating = true
        execute()
    })

    // Return object to be able to update on variable change or close stream on component destroyed
    current_data.update = () => {
        // Dependency variable updated, update query on next tick
        if(updating)
            return current_data

        updating = true
        self.$nextTick(() => {
            if(stream.close)
                stream.close()

            execute()
        })

        return current_data
    }

    current_data.close = () => {
        stream.close && stream.close()
        stop_watcher()
        return current_data
    }

    current_data.catch = (cb) => {
        catchers.push(cb)
        return current_data
    }

    return current_data
}