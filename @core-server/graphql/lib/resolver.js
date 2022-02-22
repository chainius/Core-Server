const { AuthenticationError, ForbiddenError } = require('apollo-server-errors')
var ContextLib = null

module.exports = {

    createResolver(model, options) {
        var database = options.database
        var isMulti = false
        if(options.multi) {
            isMulti = true
            options = options.multi
        } else if(options.one) {
            options = options.one
        }

        database = database || options.database

        // Execute sequelize query
        const fn = async function(parent, args, context, info) {
            if(options.before) {
                const replace = await options.before(parent, args, context, info)
                if(replace !== undefined)
                    return replace
            }

            const findOp = {
                // raw: true, // => does not work with inner joins
                attributes: [],
            }

            // Scopes handle
            if(options.scoped) {
                const session = context.session_object
                const err = (e) => new Promise((_, reject) => reject(e))    
                const autoError = (msg) => {
                    if(context.session.auth_id)
                        return err(new ForbiddenError(msg || 'Unauthorized scope'))

                    return err(new AuthenticationError('NOT_AUTHENTICATED'))
                }

                if(Array.isArray(options.scoped)) {
                    var found = false
                    for(var key of options.scoped) {
                        if(session.hasRole(key) !== -1) {
                            found = true
                            break
                        }
                    }

                    if(!found)
                        return autoError('UNAUTHORZID_SCOPE ALLOWED: ' + options.scoped.join(', '))
                } else if(!session.hasRole(options.scoped)) {
                    return autoError('UNAUTHORIZED_SCOPE')
                }
            }

            // Setup where filter in sql query
            var staticWhere = {}
            if(options.where) {
                function parseWhereClause(where) {
                    var isArray = Array.isArray(where)
                    var res = isArray ? [] : {}
                    var staticWhere = isArray ? [] : {}

                    for(var field in where) {
                        if(typeof(where[field]) === 'function') {
                            res[field] = where[field](context, args, parent)
                            if(res[field] === undefined)
                                delete res[field]
                            else if(where[field]._static)
                                staticWhere[field] = res[field]
                        } else if(typeof(where[field]) === "object" && where[field] !== null) {
                            res[field] = parseWhereClause(where[field])
                            if(res[field] === undefined)
                                delete res[field]
                            else {
                                staticWhere[field] = res[field].static
                                res[field] = res[field].dynamic
                            }
                             
                           
                        } else {
                            res[field] = where[field]
                            staticWhere[field] = where[field]
                        }

                        if(where[field] && typeof where[field]._mandatory == "boolean" && where[field]._mandatory == false && res[field] == null) {
                            delete res[field]
                            delete staticWhere[field]
                        }
                    }

                    if(isArray) {
                        res = res.filter(x => x != undefined)
                        staticWhere = staticWhere.filter(x => x != undefined)
                    }

                    if ((Array.isArray(where) && res.length == 0 && staticWhere.length == 0 ) || (Object.keys(staticWhere).length == 0 && Object.keys(res).length == 0))
                        return undefined

                    return {
                        static:  staticWhere,
                        dynamic: res,
                    }
                }

                findOp.where = parseWhereClause(options.where)
                if(findOp.where !== undefined) {
                    staticWhere = findOp.where.static
                    findOp.where = findOp.where.dynamic
                } else {
                    findOp.where = {}
                }
            }

            // Add attributes to sql query & handle foregin keys
            function handleSelectionSet(findOp, model, selectionSet) {
                for(var selection of selectionSet.selections) {
                    var name = selection.name.value
                    var alias = name
                    if(options.aliases && options.aliases[name]) {
                        alias = name
                        name = options.aliases[name]
                    }

                    if(model.tableAttributes[name]) {
                        if(alias != name)
                            findOp.attributes.push([name, alias])
                        else
                            findOp.attributes.push(name)
                    } else if(model.tableAttributes[name + '_id'] && model.tableAttributes[name + '_id'].references) {
                        const f = model.tableAttributes[name + '_id']

                        const m = (options.getModel ? options.getModel(f.references.model || f.references, ContextLib.Schemas) : null) || ContextLib.Schemas[f.references.model || f.references]
                        findOp.include = findOp.include || []
                        const r = {
                            model:      m,
                            required:   false,
                            attributes: [],
                            as:         alias,
                        }

                        findOp.include.push(r)
                        handleSelectionSet(r, m, selection.selectionSet)
                    }

                    if(options.dependencies && options.dependencies[name]) {
                        for(var field of options.dependencies[name]) {
                            if(findOp.attributes.indexOf(field) == -1)
                                findOp.attributes.push(field)
                        }
                    }
                }
            }

            for(var node of info.fieldNodes) {
                handleSelectionSet(findOp, model, node.selectionSet)
            }

            // Call after hook
            const after = async function(res) {
                if(options.after) {
                    const replace = await options.after(res, parent, args, context, info)
                    if(replace !== undefined)
                        return replace
                }

                return res
            }

            var enableWatcher = (o) => o
            if(context.req && context.req.watcher && context.req.watcher.subscribe && options.watcher !== false) {
                const table = database + "." + model.tableName
                enableWatcher = (o) => {
                    context.req.watcher.subscribe({
                        table:   table,
                        delayed: 25, // ms
                        where:   options.watcher && options.watcher.where || staticWhere,
                    })

                    return o
                }
            }

            if(options.offset)
                findOp.offset = typeof(options.offset) == "function" ? options.offset(parent, args, context, info) : options.offset

            if(options.limit)
                findOp.limit = typeof(options.limit) == "function" ? options.limit(parent, args, context, info) : options.limit

            if(options.order)
                findOp.order = typeof(options.order) == "function" ? options.order(parent, args, context, info) : options.order

            if(options.debug)
                console.log(findOp)

            if(isMulti)
                return model.findAll(findOp).then(after).then(enableWatcher)

            return model.findOne(findOp).then(after).then(enableWatcher)
        }
    
        fn.model = model
        fn.options = options
        fn.database = database
        return fn
    },

    Session: ProxySession({}),

    Params: ProxyParams(),

    TransformOptions,

    setResolverContext(ctx) {
        ContextLib = ctx
    }

}

function ProxySession(base) {
    return new Proxy(base, {
        get: function(target, name, receiver) {
            if(name === '__isProxy')
                return true

            return ProxySession(function(context) {
                if(typeof(base) === 'function')
                    context = base(context)

                if(!context)
                    return null

                if(name === 'auth_id' && context[name] === undefined)
                    throw(new AuthenticationError('You need to be connected in order to get the required resource'))

                return context[name] === undefined ? null : context[name]
            })
        },
        set: function(target, name, value, receiver) {
            if (!(name in target))
                console.log("Setting non-existing property '" + name + "', initial value: " + value)

            return Reflect.set(target, name, value, receiver)
        }
    })
}

//---------------------------------------
// query parameters

function ProxyParams() {
    return new Proxy({}, {
        get: function(target, name, receiver) {
            if(name === '__isProxy')
                return true

            return function(t, def) {
                type = t
                return {
                    Default: def,
                    IsParam: true,
                    Name:    name,
                    Type:    t,
                }
            }
        },
        set: function(target, name, value, receiver) {
            if (!(name in target))
                console.log("Setting non-existant property '" + name + "', initial value: " + value)

            return Reflect.set(target, name, value, receiver)
        }
    })
}

//---------------------------------------
// Options transformer

function TransformOptions(dest, options) {
    function encapsulateWhereClause(name, def) {
        return function(ctx, args) {
            return args[name] || def
        }
    }

    if(options.where) {
        function handleWhereParams(where) {
            for(var key in where) {
                var obj = where[key]
                if(obj !== null && typeof(obj) === 'object' && obj.IsParam === true) {
                    // Transform where close parameter
                    var mandatory = obj.Type.indexOf("!") != -1
                    // Add param to query definition
                    dest.params = dest.params || []
                    var parameter_obj = {
                        kind: "NamedType",
                        name: {
                            kind:  "Name",
                            value: obj.Type.replace("!" , ""),
                        }
                    }
                    dest.params.push({
                        kind: "InputValueDefinition",
                        name: {
                            kind:  "Name",
                            value: obj.Name,
                        },
                        type: !mandatory ? parameter_obj : {
                            kind: "NonNullType",
                            type: parameter_obj
                        },
                        directives: []
                    })
    
                    // Transform where close to function resolver
                    where[key] = encapsulateWhereClause(obj.Name, obj.Default)
                    where[key]._static = true
                    where[key]._mandatory = mandatory
                } else if(typeof(obj) === 'object' && obj !== null && !obj.__isProxy) {
                    where[key] = handleWhereParams(where[key])
                }
            }

            return where
        }

        options.where = handleWhereParams(options.where)
    }

    if(options.params && options.params.length) {
        options.params.forEach(obj => {
            var mandatory = obj.Type.indexOf("!") != -1
            dest.params = dest.params || []
            var parameter_obj = {
                kind: "NamedType",
                name: {
                    kind:  "Name",
                    value: obj.Type.replace("!" , ""),
                }
            }

            dest.params.push({
                kind: "InputValueDefinition",
                name: {
                    kind:  "Name",
                    value: obj.Name,
                },
                type: !mandatory ? parameter_obj : {
                    kind: "NonNullType",
                    type: parameter_obj
                },
                directives: []
            })
        })
    }

    return dest
}