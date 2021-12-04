const fs = require('fs')
const path = require('path')
const vm = require('vm')

function createContext() {
    const context = {}
    context.require = require
    context.setTimeout = setTimeout
    context.setInterval = setInterval
    context.setImmediate = setImmediate
    context.clearTimeout = clearTimeout
    context.clearInterval = clearInterval
    context.clearImmediate = clearImmediate
    context.Buffer = Buffer
    context.plugins = plugins
    context.process = process
    context.global = context
    context.eval = function(code) {
        const script = new vm.Script(code, {
            filename:      'ApiEval',
            lineOffset:    -1,
            displayErrors: true
        })

        return script.runInContext(context)
    }

    vm.createContext(context)
    return context
}

module.exports = function(res, queryDeff) {
    var context = createContext()

    // Iterate query dir
    var dir = path.join(process.cwd(), 'graphql', 'query')
    var files = fs.readdirSync(dir)

    // Register all files of directory
    for(var file of files) {
        const content = fs.readFileSync(path.join(dir, file))
        const name = file.substr(0, file.length-3)

        // Reset context variables
        context.module = {}
        context.console = console.create(name)

        context.Query = function(subname, type, args, cb, once = false) {
            if(typeof(type) !== 'string') {
                cb = args
                args = type
                type = subname
                subname = name
            }

            if(typeof(args) === 'function') {
                cb = args
                args = {}
            }

            var argsArr = []
            // Transform arguments
            for(var key in args) {
                var t = args[key]
                if(typeof(t) === 'function') {
                    const match = t && t.toString().match(/^\s*function (\w+)/)
                    t = (match ? match[1] : '').toLowerCase()
                    t = t.substr(0, 1).toUpperCase() + t.substr(1)

                    if(t == 'Number') {
                        t = 'Int'
                    }
                }

                argsArr.push({
                    kind: "InputValueDefinition",
                    name: {
                        kind:  "Name",
                        value: key,
                    },
                    type: {
                        kind: "NonNullType",
                        type: {
                            kind: "NamedType",
                            name: {
                                kind:  "Name",
                                value: t,
                            }
                        }
                    },
                    directives: []
                })
            }

            // Push apollo resolver to result
            res.resolvers.Query[subname] = cb

            // Add query diffinition
            queryDeff.fields.push({
                kind: "FieldDefinition",
                name: {
                    kind:  'Name',
                    value: subname,
                },
                arguments: argsArr,
                type:      once ? {
                    kind: "NamedType",
                    name: {
                        kind:  "Name",
                        value: type,
                    }
                } : {
                    kind: 'ListType',
                    type: {
                        kind: "NamedType",
                        name: {
                            kind:  "Name",
                            value: type,
                        }
                    }
                },
                directives: [],
            })
        }

        context.QueryOne = function(name, type, args, cb) {
            return context.Query(name, type, args, cb, true)
        }

        // Build script
        const script = new vm.Script(content, {
            filename:      path.join(dir, file),
            lineOffset:    0,
            displayErrors: true
        })

        // Run script
        script.runInContext(context)
    }
}