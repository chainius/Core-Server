import create_mutation from './mutations'
import create_query from './query';
import framgentsIn from './fragments'

var glob_id = 0;

export default class Document {

    // Create a new query, mutation or subscription representation
    constructor(mixin, options, fragments, attributes, handler = null) {
        Object.assign(this, options)

        if(this.operation === 'query')
            Object.assign(mixin, this.query_mixin(handler, attributes, fragments.filter(framgentsIn(options))))
        else if(this.operation === 'mutation' && handler !== null)
            Object.assign(mixin, this.mutation_mixin(handler, attributes, fragments))
    }

    // Extract used variables in graphql from vuejs instance
    variables(instance) {
        var vars = {}
        for(var obj of this.variableDefinitions) {
            var name = obj.variable.name.value
            vars[name] = instance[name]
        }

        return vars
    }

    // Auto assign data fields to vue instances with null as default value
    query_mixin(handler = null, attributes = {}, fragments = []) {
        var document = this
        var id = glob_id++

        // Extract all required variables from graphql
        var onChange = function() {
            if(this.$gqw && this.$gqw[id])
                this.$gqw[id].update()
        }

        // Init watchers to detect dependencie changes
        var watch = {}
        for(var obj of this.variableDefinitions)
            watch[obj.variable.name.value] = onChange

        // Create mixin
        var mixin = {
            watch,
            data() {
                var vars = document.selectionSet.selections.map((o) => o.alias && o.alias.value || o.name.value)
                var res = {}
                for(var key of vars)
                    res[key] = null

                return res
            }
        }

        // Add methods
        mixin.$query = {}
        for(var selection of this.selectionSet.selections) {
            var subFragments = fragments.filter(framgentsIn(selection))
            mixin.$query[selection.name.value] = create_mutation(handler, attributes, selection, this, subFragments)
        }

        // Auto execute query mixin
        if(handler !== null) {
            mixin.mounted = function() {
                this.$gqw = this.$gqw || {}
                this.$gqw[id] = create_query.call(this, handler, attributes, document, fragments)
            }

            mixin.destroyed = function() {
                for(var e in this.$gqw) {
                    this.$gqw[e].close()
                    delete this.$gqw[e]
                }
            }
        }

        return mixin
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