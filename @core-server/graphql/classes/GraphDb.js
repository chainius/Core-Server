const fs = require('fs')
const path = require('path')
const vm = require('vm')
const Sequelize = require('sequelize')
const contextLib = require('../lib/context.js')
const qContent = require('../lib/query_context.js')
const { gql } = require('apollo-server-express')

const funcStart = "func = function(console, __filename, __dirname) { " +
                    "\n"

class GraphDB {

    createContext() {
        const context = contextLib
        context.func = false
        // context.$__require      = _require;
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

    construct(host, user, pass, db) {
        const Op = Sequelize.Op
        const operatorsAliases = {
            $eq:            Op.eq,
            $ne:            Op.ne,
            $gte:           Op.gte,
            $gt:            Op.gt,
            $lte:           Op.lte,
            $lt:            Op.lt,
            $not:           Op.not,
            $in:            Op.in,
            $notIn:         Op.notIn,
            $is:            Op.is,
            $like:          Op.like,
            $notLike:       Op.notLike,
            $iLike:         Op.iLike,
            $notILike:      Op.notILike,
            $regexp:        Op.regexp,
            $notRegexp:     Op.notRegexp,
            $iRegexp:       Op.iRegexp,
            $notIRegexp:    Op.notIRegexp,
            $between:       Op.between,
            $notBetween:    Op.notBetween,
            $overlap:       Op.overlap,
            $contains:      Op.contains,
            $contained:     Op.contained,
            $adjacent:      Op.adjacent,
            $strictLeft:    Op.strictLeft,
            $strictRight:   Op.strictRight,
            $noExtendRight: Op.noExtendRight,
            $noExtendLeft:  Op.noExtendLeft,
            $and:           Op.and,
            $or:            Op.or,
            $any:           Op.any,
            $all:           Op.all,
            $values:        Op.values,
            $col:           Op.col
        }

        var config = {
            host:    host,
            dialect: 'mysql',
            logging: false,
            operatorsAliases,
            // dialectOptions: {
            //     decimalNumbers: true,
            // }
        }

        const srcContext = require('path').join(process.cwd(), 'graphql', 'src', 'config.js')
        if(fs.existsSync(srcContext))
            config = Object.assign(config, require(srcContext).sequelize || {})

        this.sequelize = new Sequelize(db, user, pass, config)

        this.database = db
        return this.buildSchemas()
    }

    buildSchemas() {
        const context = this.createContext()
        const sequelize = this.sequelize
        const queryDeff = {
            kind:        'ObjectTypeDefinition',
            description: undefined,
            name:        {
                kind:  'Name',
                value: 'Query'
            },
            interfaces: [],
            directives: [],
            fields:     [],
        }

        const res = {
            schemas:   {},
            resolvers: {
                Query: {}
            },
            typeDefs: {
                kind:        'Document',
                definitions: [
                    queryDeff,
                ],
                loc: {
                    start: 0,
                    end:   0,
                }
            },
        }

        // Register db fiiles
        var foreign = []
        var exploreDirectory

        exploreDirectory = (dir, dirName = null) => {
            var files = fs.readdirSync(dir)
            var schemas = {}

            for(var file of files) {
                var p = path.join(dir, file)
                var name = file == 'index.js' && dirName != null ? dirName : file.substr(0, file.length-3)
    
                if(fs.lstatSync(p).isDirectory()) {
                    schemas[file] = exploreDirectory(path.join(dir, file), file)
                    continue
                }
    
                const schema = this.parseFile(p, context)
                if(!schema)
                    continue
                // Transform schema
                {
                    // Sql schema
                    const build = schema.BuildSequelize(sequelize)
                    if(file == 'index.js' && dirName != null) {
                        schemas = Object.assign(build.schema, schemas)
                    } else {
                        schemas[name] = build.schema
                    }

                    if(build.foreign && Object.keys(build.foreign).length > 0) {
                        foreign.push({
                            schema: build.schema,
                            fields: build.foreign
                        })
                    }
                }
                {
                    // Graphql schema
                    const build = schema.BuildGraphql(name, this)
                    if(build !== null) {
                        // Add schema definition in graphql
                        for(var deff of build.definitions)
                            res.typeDefs.definitions.push(deff)
    
                        // Add resolvers
                        for(var resolver of build.resolvers) {
                            if(resolver.query) {
                                const name = resolver.query.name.value
                                res.resolvers.Query[name] = resolver.resolve
                                queryDeff.fields.push(resolver.query)
                            }

                            if(resolver.type) {
                                const append = (types, dest) => {
                                    for(var type in types) {
                                        if(typeof(types[type]) === 'function') {
                                            dest[type] = types[type]
                                        } else {
                                            dest[type] = dest[type] || {}
                                            append(types[type], dest[type])
                                        }
                                    }
                                }

                                append(resolver.type, res.resolvers)
                            }
                        }
                    }
                }
            }

            return schemas
        }
    
        res.schemas = exploreDirectory(path.join(process.cwd(), 'graphql', 'db'), res.schemas)

        // Parse foreign keys
        for(var item of foreign) {
            for(var key in item.fields) {
                // res.schemas[field[key]].belongsTo(res.schemas[name])
                var n = key
                if(n.substr(-3) === '_id')
                    n = n.substr(0, n.length-3)

                const relatedModel = contextLib.SchemasByTableName[ item.fields[key] ]
                item.schema.belongsTo(relatedModel, { as: n, foreignKey: key })
                // res.schemas[field[key]].hasMany(res.schemas[name], { foreignKey: field[key] })
            }
        }

        // Register static types
        var dir = path.join(process.cwd(), 'graphql', 'types')
        var files = fs.readdirSync(dir)
        for(var file of files) {
            var deff = this.readGql(path.join(dir, file))
            for(var d of deff.definitions)
                res.typeDefs.definitions.push(d)
        }

        // Register custom query functions
        qContent(res, queryDeff)

        return res
    }

    parseFile(path, context) {
        const source = fs.readFileSync(path)
        const script = new vm.Script(funcStart + source + "\n }", {
            filename:      path,
            lineOffset:    -1,
            displayErrors: true
        })

        contextLib.file = path
        script.runInContext( context )
        const schema = context.func(console.create('graphql'))
        context.func = null
        return schema
    }

    readGql(path) {
        const src = fs.readFileSync(path).toString()
        return gql(src)
    }

    static Instance() {
        if(!this._instance)
            this._instance = new this()

        return this._instance
    }

}

module.exports = GraphDB