const fs         = require('fs')
const path       = require('path')
const vm         = require('vm')
const Sequelize  = require('sequelize')
const contextLib = require('../lib/context.js')
const qContent   = require('../lib/query_context.js')
const { gql }    = require('apollo-server-express')

const funcStart = "func = function(console, __filename, __dirname) { " +
                    "\n";

class GraphDB {

    createContext() {
        const context           = contextLib;
        context.func            = false;
        //context.$__require      = _require;
        context.setTimeout      = setTimeout;
        context.setInterval     = setInterval;
        context.setImmediate    = setImmediate;
        context.clearTimeout    = clearTimeout;
        context.clearInterval   = clearInterval;
        context.clearImmediate  = clearImmediate;
        context.Buffer          = Buffer;
        context.plugins         = plugins;
        context.process         = process;
        context.global          = context;

        context.eval = function(code) {
            const script = new vm.Script(code, {
                filename: 'ApiEval',
                lineOffset: -1,
                displayErrors: true
            });

            return script.runInContext(context);
        };

        vm.createContext(context);
        return context;
    }

    construct(host, user, pass, db) {
        const Op = Sequelize.Op;
        const operatorsAliases = {
            $eq: Op.eq,
            $ne: Op.ne,
            $gte: Op.gte,
            $gt: Op.gt,
            $lte: Op.lte,
            $lt: Op.lt,
            $not: Op.not,
            $in: Op.in,
            $notIn: Op.notIn,
            $is: Op.is,
            $like: Op.like,
            $notLike: Op.notLike,
            $iLike: Op.iLike,
            $notILike: Op.notILike,
            $regexp: Op.regexp,
            $notRegexp: Op.notRegexp,
            $iRegexp: Op.iRegexp,
            $notIRegexp: Op.notIRegexp,
            $between: Op.between,
            $notBetween: Op.notBetween,
            $overlap: Op.overlap,
            $contains: Op.contains,
            $contained: Op.contained,
            $adjacent: Op.adjacent,
            $strictLeft: Op.strictLeft,
            $strictRight: Op.strictRight,
            $noExtendRight: Op.noExtendRight,
            $noExtendLeft: Op.noExtendLeft,
            $and: Op.and,
            $or: Op.or,
            $any: Op.any,
            $all: Op.all,
            $values: Op.values,
            $col: Op.col
        }

        this.sequelize = new Sequelize(db, user, pass, {
            host:    host,
            dialect: 'mysql',
            logging: false,
            operatorsAliases,
        });

        return this.buildSchemas()
    }

    buildSchemas() {
        const context   = this.createContext()
        const sequelize = this.sequelize
        const queryDeff = {
            kind: 'ObjectTypeDefinition',
            description: undefined,
            name: {
                kind: 'Name',
                value: 'Query'
            },
            interfaces: [],
            directives: [],
            fields: [],
        }

        const res =  {
            schemas: {},
            resolvers: {
                Query: {}
            },
            typeDefs: {
                kind: 'Document',
                definitions: [
                    queryDeff,
                ],
                loc: {
                    start: 0,
                    end: 0,
                }
            },
        }

        // Register db fiiles
        var dir = path.join(process.cwd(), 'graphql', 'db')
        var files = fs.readdirSync(dir);
        var foreign = {}

        for(var file of files) {
            const schema = this.parseFile(path.join(dir, file), context)
            const name = file.substr(0, file.length-3)
            {
                //Sql schema
                const build = schema.BuildSequelize(sequelize)
                res.schemas[name] = build.schema
                foreign[name] = build.foreign
            }
            {
                //Graphql schema
                const build = schema.BuildGraphql(name)
                if(build !== null) {
                    // Add schema definition in graphql
                    for(var deff of build.definitions)
                        res.typeDefs.definitions.push(deff)

                    // Add resolvers
                    for(var resolver of build.resolvers) {
                        const name = resolver.query.name.value
                        res.resolvers.Query[name] = resolver.resolve
                        queryDeff.fields.push(resolver.query)
                    }
                }
            }
        }
    
        for(var name in foreign) {
            const field = foreign[name]
            for(var key in field) {
                //res.schemas[field[key]].belongsTo(res.schemas[name])
                var n = key
                if(n.substr(-3) === '_id')
                    n = n.substr(0, n.length-3)

                res.schemas[name].belongsTo(res.schemas[field[key]], { as: n, foreignKey: key })
                //res.schemas[field[key]].hasMany(res.schemas[name], { foreignKey: field[key] })
            }
        }

        // Register static types
        dir = path.join(process.cwd(), 'graphql', 'types')
        files = fs.readdirSync(dir);
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
            filename:       path,
            lineOffset:     -1,
            displayErrors:  true
        });

        script.runInContext( context );
        const schema = context.func(console.create('graphql'));
        context.func = null;
        return schema;
    }

    readGql(path) {
        const src = fs.readFileSync(path).toString()
        return gql(src)
    }

}

module.exports = new GraphDB()