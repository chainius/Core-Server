var querystring = require('querystring')
var gql = require('graphql-tag')
const { createUnplugin } = require('unplugin')
const { print } = require('graphql/language/printer.js')
// var fs                   = require('fs')
// var path                 = require('path')

function getAttributes(query) {
    var q = querystring.parse(query)
    delete q.vue
    delete q.type
    delete q.index
    delete q.blockType

    for(var key in q) {
        if(q[key] === 'true')
            q[key] = true
        else if(q[key] === 'false')
            q[key] = false
    }

    return q
}

// function getHandlerPath(root) {
//     var p = path.join(root, 'src', 'plugins', 'graphql.js')
//     if(fs.existsSync(p))
//         return p

//     p = path.join(root, 'src', 'graphql.js')
//     if(fs.existsSync(p))
//         return p

//     return null
// }

function extract_attributes(n, attr = {}) {
    // create a copy to prevent caching issues from gql
    // otherwise after a second compilation, gql will not return the same object when the graphql hasn't been changed (get from caches)
    var output = Object.assign({}, n)

    output.definitions = output.definitions.map((o) => {
        for(var d of o.directives) {
            if(d.name.value === 'attr') {
                for(var arg of d.arguments) {
                    attr[arg.name.value] = arg.value.value
                }
            } else {
                attr[d.name.value] = true
            }
        }

        var res = Object.assign({}, o)
        res.directives = []
        return res
    })

    return output
}

function auto_variables(n, kinds = {}) {
    for(var def of n.definitions) {
        var known_vars = {}
        for(var i of (def.variableDefinitions || [])) {
            known_vars[i.variable.name.value] = true
        }

        for(var selection of def.selectionSet.selections) { 
            for(var arg of selection.arguments) {
                if(arg.kind != 'Argument' || arg.value.kind != 'Variable')
                    continue

                const var_name = arg.value.name.value
                if(!known_vars[var_name] && kinds[var_name]) {
                    def.variableDefinitions = def.variableDefinitions || []
                    def.variableDefinitions.push({
                        kind:         'VariableDefinition',
                        variable:     { kind: 'Variable', name: { kind: 'Name', value: var_name } },
                        type:         kinds[var_name],
                        defaultValue: undefined,
                    })

                    known_vars[var_name] = true
                }
            }
        }
    }

    return n
}

function load_var_types(options) {
    var r = options.static_types || {}
    try {
        r = require(options.handler + '/kinds.json')
    } catch(e) {
        if(e.code != 'MODULE_NOT_FOUND') {
            console.warn("no satic graphql kinds.json found", e)
            return null
        }
    }

    if(Object.keys(r).length == 0)
        return null

    var q = "query("
    var first = true

    for(var k in r) {
        if(!first)
            q += ', '

        q += "$" + k + ": " + r[k] + " "
        first = false
    }

    q = gql(q + ") { __schema }")
    var res = {}
    for(var item of q.definitions[0].variableDefinitions) {
        res[item.variable.name.value] = item.type
    }

    return res
}

function generate(source, id, options) {
    var index = id.indexOf('?') + 1

    var graph = gql(source)
    const attr = index == 0 ? {} : getAttributes(id.substr(index))
    const fileName = index == 0 ? id : id.substr(0, index - 1)
    const isMixin = index == 0 || fileName.endsWith('.gql')

    graph = extract_attributes(graph, attr)

    const auto_types = load_var_types(options)
    if(auto_types) {
        graph = auto_variables(graph, auto_types)    
    }

    options.print && console.log(print(graph))

    const query = graph.definitions.find((o) => o.operation === 'query')
    const mutation = graph.definitions.find((o) => o.operation === 'mutation')
    const subscription = graph.definitions.find((o) => o.operation === 'subscription')
    const fragments = graph.definitions.filter((o) => o.kind === 'FragmentDefinition')
    const documentPath = require.resolve('./document.js')
    const handler = options.handler || null // getHandlerPath('') // ToDo attach root dor

    var res = `import Document from '${documentPath}'
        ${handler !== null ? `import Handler, { provides } from '${handler}'` : 'var Handler = null, provides = () => ({})'}

        var attr       = ${JSON.stringify(attr)}
        var fragments  = ${JSON.stringify(fragments)}
        var mixin      = {}

        export let $gql = {
            attr: attr,
            fragments: fragments,
            query: ${query ? 'new Document(mixin, '+JSON.stringify(query)+', fragments, attr, Handler, provides)' : 'null'},
            mutation: ${mutation ? 'new Document(mixin, '+JSON.stringify(mutation)+', fragments, attr, Handler, provides)' : 'null'},
            subscription: ${subscription ? 'new Document(mixin, '+JSON.stringify(subscription)+', fragments, attr, Handler, provides)' : 'null'},
        }
    `

    if(isMixin) {
        return `${res}

        import { getCurrentInstance, onUnmounted } from 'vue'

        mixin.use = function(data) {
            const instance = getCurrentInstance()
            onUnmounted($gql.query.unmounted.bind($gql.query, instance))
            return $gql.query.use(instance, data)
        }

        export default mixin`
    }

    return `${res}
        export default function (Component) {
            Component.$gql = Component.$gql || []
            Component.mixins = Component.mixins || []

            Component.mixins.push(mixin)
            Component.$gql.push($gql)
        }
    `
}

// creates universal graphql plugin
module.exports = createUnplugin((options) => {
    return {
        name: 'vue-au-graphql-loader',
        transformInclude(id) {
            if(id.endsWith('.gql'))
                return true

            if(!id.includes('type=graphql'))
                return false

            var uri = id.substring(0, id.indexOf('?'))
            if(!uri.endsWith('.vue'))
                return false

            return true
        },
        transform (code, id) {
            return generate(code, id, options)
        },
    }
})