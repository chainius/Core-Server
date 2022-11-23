var querystring = require('querystring')
var gql = require('graphql-tag')
const { createUnplugin } = require('unplugin')
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
    for(var o of n.definitions) {
        for(var d of o.directives) {
            if(d.name.value === 'attr') {
                for(var arg of d.arguments) {
                    attr[arg.name.value] = arg.value.value
                }
            } else {
                attr[d.name.value] = true
            }
        }

        o.directives = []
    }

    return attr
}

function generate(source, id, options) {
    var index = id.indexOf('?') + 1

    const graph = gql(source)
    const attr = index == 0 ? {} : getAttributes(id.substr(index))
    const fileName = index == 0 ? id : id.substr(0, index - 1)
    const isMixin = index == 0 || fileName.endsWith('.gql')
    const query = graph.definitions.find((o) => o.operation === 'query')
    const mutation = graph.definitions.find((o) => o.operation === 'mutation')
    const subscription = graph.definitions.find((o) => o.operation === 'subscription')
    const fragments = graph.definitions.filter((o) => o.kind === 'FragmentDefinition')
    const documentPath = require.resolve('./document.js')
    const handler = options.handler || null // getHandlerPath('') // ToDo attach root dor

    extract_attributes(graph, attr)

    var res = `import Document from '${documentPath}'
        ${handler !== null ? `import Handler from '${handler}'` : 'var Handler = null'}

        var attr       = ${JSON.stringify(attr)}
        var fragments  = ${JSON.stringify(fragments)}
        var mixin      = {}

        export let $gql = {
            attr: attr,
            fragments: fragments,
            query: ${query ? 'new Document(mixin, '+JSON.stringify(query)+', fragments, attr, Handler)' : 'null'},
            mutation: ${mutation ? 'new Document(mixin, '+JSON.stringify(mutation)+', fragments, attr, Handler)' : 'null'},
            subscription: ${subscription ? 'new Document(mixin, '+JSON.stringify(subscription)+', fragments, attr, Handler)' : 'null'},
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