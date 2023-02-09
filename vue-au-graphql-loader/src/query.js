import { withFragments } from './fragments'
import { shallowRef, watchEffect } from 'vue'

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
        res[key] = null

    return shallowRef(res)
}

export default function create_query(data, handler, attributes, query, fragments) {
    var self = this
    var current_data = initial_data(query)
    var catchers = []

    current_data.loading = shallowRef(true)
    current_data.initial_loading = shallowRef(true)

    // Create a stream object to assign results to component
    var stream = {
        emit(data) {
            current_data.value = data
            current_data.loading.value = false
            current_data.initial_loading.value = false
            updating = false

            // Call graphql hooks
            exec(self.$options.graphql?.success, self, data)
            exec(self.$options.graphql?.done, self)
        },

        error(err) {
            updating = false
            current_data.loading.value = false
            current_data.initial_loading.value = false

            // Call graphql hooks
            exec(self.$options.graphql?.error, self, err)
            exec(catchers, self, err)
            exec(self.$options.graphql?.done, self)
        }
    }

    // Query execution function
    var execute = () => {
        try {
            current_data.loading.value = true
            // Call query on handler
            var res = handler({
                query:      withFragments(query, fragments),
                variables:  query.variables(data, this),
                attributes: attributes,
                component:  this,
                stream,
            })

            // Send handler result to data stream
            if(!res || res == stream) {
                updating = false
            } else if(res.then) {
                res.then(stream.emit).catch(stream.error)
            } else {
                stream.emit(res)
            }
        } catch(e) {
            stream.error(e)
        }

        updating = false
    }

    // Execute query
    var updating = false
    const stop_watcher = watchEffect(() => {
        if(updating)
            return
 
        updating = true

        if(stream.close) {
            stream.close()
            delete stream.close()
        }

        execute()
    })

    // Return object to be able to update on variable change or close stream on component destroyed
    current_data.update = () => {
        // Dependency variable updated, update query on next tick
        if(updating)
            return current_data

        updating = true
        self.$nextTick(() => {
            if(stream.close) {
                stream.close()
                delete stream.close()
            }

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
        if(!cb) {
            var dest = shallowRef(null)
            catchers.push((err) => dest.value = err)
            return dest
        }

        catchers.push(cb)
        return current_data
    }

    return current_data
}