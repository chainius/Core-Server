import create_mutation from './mutations'
import create_query from './query'
import framgentsIn from './fragments'
import { getCurrentInstance, unref, provide } from "vue"

var glob_id = 0

export default class Document {

    #id = 0

    #handler = null

    #attr = null

    #query_fragments = null

    #provides = null

    // Create a new query, mutation or subscription representation
    constructor(mixin, options, fragments, attributes, handler = null, provides = () => ({})) {
        Object.assign(this, options)
        this.#id = glob_id++
        this.#handler = handler
        this.#attr = attributes
        this.#provides = provides
        this.#query_fragments = fragments.filter(framgentsIn(options))

        if(this.operation === 'query')
            Object.assign(mixin, this.query_mixin(handler, attributes, fragments.filter(framgentsIn(options))))
        else if(this.operation === 'mutation' && handler !== null)
            Object.assign(mixin, this.mutation_mixin(handler, attributes, fragments))
    }

    // Extract used variables in graphql from vuejs instance
    variables(instance) {
        var vars = {}
        var provided = null

        for(var obj of this.variableDefinitions) {
            var name = obj.variable.name.value

            if(instance[name] !== undefined) {
                vars[name] = unref(instance[name])
                continue
            }

            if(provided === null)
                provided = this.#provides()

            vars[name] = unref(provided[name])
        }

        return vars
    }

    use(component, data) {
        component.graphql = component.graphql || {}
        data = data || component.ctx
        var res = component.graphql[this.#id]

        if(!res) {
            res = create_query.call(component.ctx, data, this.#handler, this.#attr, this, this.#query_fragments)
            component.graphql[this.#id] = res

            if(this.#attr.inject) {
                provide('initial_loading', res.initial_loading)
                provide('loading', res.loading)
                provide('error', res.catch())
            }
        }

        return res
    }

    // Auto assign data fields to vue instances with null as default value
    query_mixin(handler = null, attributes = {}, fragments = []) {
        var self = this

        // Create mixin
        var mixin = {}

        // Add methods
        mixin.$query = {}
        for(var selection of this.selectionSet.selections) {
            var subFragments = fragments.filter(framgentsIn(selection))
            mixin.$query[selection.name.value] = create_mutation(handler, attributes, selection, this, subFragments)
        }

        // Auto execute query mixin
        if(handler !== null) {
            function proxy(self, res, key) {
                Object.defineProperty(self, key, {
                    get() {
                        return res.value[key]
                    },
                    set(val) {
                        n = res.value
                        n[key] = val
                        res.value = n
                    },
                    enumerable:   true,
                    configurable: true
                })
            }

            mixin.created = function() {
                const res = self.use(getCurrentInstance())
                for(var key in res._rawValue) {
                    proxy(this, res, key)
                }
            }

            mixin.unmounted = () => this.unmounted(getCurrentInstance())
        }

        return mixin
    }
    
    unmounted(instance) {
        const $gqw = instance.graphql || {}
        for(var e in $gqw) {
            $gqw[e].close()
            delete $gqw[e]
        }
    }

    // Auto assign graphql methods to vue component
    mutation_mixin(handler, attributes, fragments) {
        var methods = {}
        for(var selection of this.selectionSet.selections) {
            var subFragments = fragments.filter(framgentsIn(selection))
            methods[selection.name.value] = create_mutation(handler, attributes, selection, this, subFragments)
        }

        return { methods }
    }

}