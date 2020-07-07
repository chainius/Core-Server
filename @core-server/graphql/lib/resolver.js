const { AuthenticationError } = require('apollo-server-errors')

module.exports = {

    createResolver(model, options) {
        var isMulti = false
        if(options.multi) {
            isMulti = true
            options = options.multi
        } else if(options.one) {
            options = options.one
        }

        const fn = function(parent, args, context, info) {
            const findOp = {
                // raw: true, // => does not work with inner joins
                attributes: [],
            }

            // Scopes handle
            if(options.scoped) {
                const err = (e) => new Promise((_, reject) => reject(e))
                if(!Array.isArray(context.permissions))
                    return err(new AuthenticationError('Unauthorized scope'))

                if(Array.isArray(options.scoped)) {
                    var found = false
                    for(var key of options.scoped) {
                        if(context.permissions.indexOf(key) !== -1) {
                            found = true
                            break
                        }
                    }

                    if(!found)
                        return err(new AuthenticationError('Unauthorized scope'))
                } else if(context.permissions.indexOf(options.scoped) == -1) {
                    return err(new AuthenticationError('Unauthorized scope'))
                }
            }

            // Setup where filter in sql query
            if(options.where) {
                function parseWhereClause(where) {
                    var res = {}

                    for(var field in where) {
                        if(typeof(where[field]) === 'function') {
                            res[field] = where[field](context, args, parent)
                        } else if(typeof(where[field]) === "object" && where[field] !== null) {
                            res[field] = parseWhereClause(where[field])
                        } else {
                            res[field] = where[field]
                        }
                    }

                    return res
                }

                findOp.where = parseWhereClause(options.where)
            }

            // Add attributes to sql query & handle foregin keys
            function handleSelectionSet(findOp, model, selectionSet) {
                for(var selection of selectionSet.selections) {
                    if(model.tableAttributes[selection.name.value]) {
                        findOp.attributes.push(selection.name.value)
                    } else if(model.tableAttributes[selection.name.value + '_id'] && model.tableAttributes[selection.name.value + '_id'].references) {
                        const f = model.tableAttributes[selection.name.value + '_id']
                        const m = plugins.getEntry('http/MasterServer').siteManager.schemas[f.references]

                        findOp.include = findOp.include || []
                        const r = {
                            model: m,
                            required: false,
                            attributes: [],
                            as: selection.name.value,
                        }

                        findOp.include.push(r)
                        handleSelectionSet(r, m, selection.selectionSet)
                    }
                }
            }

            for(var node of info.fieldNodes) {
                handleSelectionSet(findOp, model, node.selectionSet)
            }

            if(isMulti)
                return model.findAll(findOp)

            return model.findOne(findOp)
        }
    
        fn.model = model
        fn.options = options
        return fn
    },

    Session: ProxySession({}),

    Params:  ProxyParams(),

    TransformOptions,

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
                console.log("Setting non-existing property '" + name + "', initial value: " + value);

            return Reflect.set(target, name, value, receiver);
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

            return function(t) {
                type = t
                return {
                    IsParam: true,
                    Name: name,
                    Type: t,
                }
            }
        },
        set: function(target, name, value, receiver) {
            if (!(name in target)) {
                console.log("Setting non-existant property '" + name + "', initial value: " + value);
            }
            return Reflect.set(target, name, value, receiver);
        }
    })
}

//---------------------------------------
// Options transformer

function TransformOptions(dest, options) {
    function encapsulateWhereClause(name) {
        return function(ctx, args) {
            return args[name]
        }
    }

    if(options.where) {
        function handleWhereParams(where) {
            for(var key in where) {
                var obj = where[key]
                if(obj !== null && typeof(obj) === 'object' && obj.IsParam === true) {
                    // Transform where close parameter

                    // Add param to query definition
                    dest.params = dest.params || []
                    dest.params.push({
                        kind: "InputValueDefinition",
                        name: {
                          kind: "Name",
                          value: obj.Name,
                        },
                        type: {
                          kind: "NonNullType",
                          type: {
                            kind: "NamedType",
                            name: {
                              kind: "Name",
                              value: obj.Type,
                            }
                          }
                        },
                        directives: []
                    })
    
                    // Transform where close to function resolver
                    where[key] = encapsulateWhereClause(obj.Name)
                } else if(typeof(obj) === 'object' && obj !== null && !obj.__isProxy) {
                    where[key] = handleWhereParams(where[key])
                }
            }

            return where
        }

        options.where = handleWhereParams(options.where)
    }

    return dest
}