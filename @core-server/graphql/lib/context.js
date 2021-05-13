const Sequelize = require('sequelize')
const Path      = require('path')
const fs        = require('fs')
const Model     = Sequelize.Model
const { schemaDeffinition, graphConfig, camelize, getComputedFields } = require('./typedeff.js')
const { createResolver, Session, Params, TransformOptions, setResolverContext } = require('./resolver.js')

const context = {
    SchemasByTableName: {},
    plugins,
    require,
    Schema(table, fields) {
        if(fields === undefined) {
            fields = table
            table = Path.basename(module.exports.file)
            table = table.substr(0, table.length - 3)
        }

        var hasGraphql = false
        var multiSelector = null
        var oneSelector = null
        // var computedFields = {}
        var schema;
        var schemaOptions = {};
        var graphqlDepencies = {}

        const obj = {
            Configure(options) {
                schemaOptions = options
                return this
            },
            Hooks() {
                // ToDo
                return this
            },
            Query(options) {
                multiSelector = TransformOptions({
                    multi: options,
                }, options)

                multiSelector.multi.dependencies = multiSelector.multi.dependencies || graphqlDepencies
                hasGraphql = true
                return this
            },
            QueryOne(options) {
                oneSelector = TransformOptions({
                    one: options
                }, options)

                oneSelector.one.dependencies = oneSelector.one.dependencies || graphqlDepencies
                hasGraphql = true
                return this
            },
            BuildSequelize(sequelize) {
                const foreignKeys = {}

                class Table extends Model {}
                const config = {}
                for(var name in fields) {
                    if(fields[name].sequelize) {
                        if(fields[name].foreign) {
                            fields[name].sequelize.references = {
                                model: fields[name].foreign,
                                key: 'id'
                            }
                        }

                        config[name] = fields[name].sequelize
                        if(fields[name].foreign)
                            foreignKeys[name] = fields[name].foreign
                    }
                }

                schema = Table.init(config, Object.assign({
                    sequelize,
                    modelName: table,
                    freezeTableName: true,
                    timestamps: (config.updatedAt !== undefined && config.createdAt !== undefined),
                }, schemaOptions))

                context.SchemasByTableName[table] = schema
                
                return {
                    foreign: foreignKeys,
                    schema
                }
            },
            BuildGraphql(name = table) {
                if(!hasGraphql)
                    return null
                if(schemaOptions.graphqlName)
                    name = schemaOptions.graphqlName

                return {
                    definitions: [
                        schemaDeffinition(name, fields)
                    ],
                    resolvers: [
                        multiSelector ? {
                            query: {
                                kind: "FieldDefinition",
                                name: {
                                    kind: 'Name',
                                    value: name,
                                },
                                arguments:  multiSelector.params || [],
                                type: {
                                    kind: 'ListType',
                                    type: {
                                        kind: "NamedType",
                                        name: {
                                            kind: "Name",
                                            value: camelize(name),
                                        }
                                    }
                                },
                                directives: [],
                            },
                            resolve: multiSelector.multi.resolve || createResolver(schema, Object.assign(multiSelector))
                        } : null,

                        oneSelector ? {
                            query: {
                                kind: "FieldDefinition",
                                name: {
                                    kind: 'Name',
                                    value: name.substr(-1, 1) === 's' ? name.substr(0, name.length-1) : name,
                                },
                                arguments: oneSelector.params || [],
                                type: {
                                    kind: "NamedType",
                                    name: {
                                        kind: "Name",
                                        value: camelize(name),
                                    }
                                },
                                directives: [],
                            },
                            resolve: oneSelector.one.resolve || createResolver(schema, Object.assign(oneSelector))
                        } : null,

                        getComputedFields(name, fields),
                    ].filter((o) => o !== null)
                }
            },
            Field(name, type, dependencies, fn) {
                if(!fn) {
                    fn = dependencies
                    dependencies = []
                }

                if(!fn) {
                    fn = type
                    type = 'String'
                }

                if(dependencies && dependencies.length > 0)
                    graphqlDepencies[name] = dependencies

                fields[name] = context.Computed(type, fn)
                return this
            },
            Dependency(field, dependencies) {
                graphqlDepencies[field] = dependencies
            }
        }

        return obj
    },
    PrimaryKey: {
        graphql: {
            typeName: 'ID!'
        },
        /*sequelize: {

        }*/
    },
    Varchar(count, def, config) {
        if(typeof(def) === 'object' && def !== null) {
            config = def
            def = undefined
        } else if(config === undefined) {
            config = {}
        }

        return {
            graphql: graphConfig(config, {
                typeName: 'String'
            }),
            sequelize: {
                field:        config.sql,
                type:         Sequelize.STRING(count),
                primaryKey:   config.primaryKey,
                allowNull:    def === null || config.nullable,
                defaultValue: def === undefined ? (config.nullable ? null : '') : def,
                unique:       config.unique,
            }
        }
    },
    Text(def, config) {
        if(typeof(def) === 'object' && def !== null) {
            config = def
            def = undefined
        } else if(config === undefined) {
            config = {}
        }

        return {
            graphql: graphConfig(config, {
                typeName: 'String'
            }),
            sequelize: {
                field:        config.sql,
                type:         Sequelize.TEXT,
                allowNull:    def === null,
                defaultValue: def,
            }
        }
    },
    Int(def, config = {}) {
        if(typeof(def) === 'object' && def !== null) {
            config = def
            def = undefined
        }

        return {
            graphql: graphConfig(config, {
                typeName: 'Int'
            }),
            sequelize: {
                field:        config.sql,
                type:         Sequelize.INTEGER,
                primaryKey:   config.primaryKey,
                allowNull:    def === null,
                defaultValue: def === undefined ? '0' : def,
            },
            foreign: config.foreign,
        }
    },
    MediumInt(count, def, config) {
        if(typeof(def) === 'object' && def !== null) {
            config = def
            def = undefined
        } else if(config === undefined) {
            config = {}
        }

        return {
            graphql: graphConfig(config, {
                typeName: 'Int'
            }),
            sequelize: {
                field:        config.sql,
                type:         Sequelize.MEDIUMINT(count),
                allowNull:    def === null,
                defaultValue: def,
            },
            foreign: config.foreign,
        }
    },
    SmallInt(count, def, config) {
        if(typeof(def) === 'object' && def !== null) {
            config = def
            def = undefined
        } else if(config === undefined) {
            config = {}
        }

        return {
            graphql: graphConfig(config, {
                typeName: 'Int'
            }),
            sequelize: {
                field:        config.sql,
                type:         Sequelize.SMALLINT(count),
                allowNull:    def === null,
                defaultValue: def,
            },
            foreign: config.foreign,
        }
    },
    TinyInt(count, def, config) {
        if(typeof(def) === 'object' && def !== null) {
            config = def
            def = undefined
        } else if(config === undefined) {
            config = {}
        }

        return {
            graphql: graphConfig(config, {
                typeName: 'Int'
            }),
            sequelize: {
                field:        config.sql,
                type:         Sequelize.TINYINT(count),
                allowNull:    def === null,
                defaultValue: def,
            }
        }
    },
    Decimal(count, decimals, def, config) {
        if(typeof(def) === 'object' && def !== null) {
            config = def
            def = undefined
        } else if(config === undefined) {
            config = {}
        }

        return {
            graphql: graphConfig(config, {
                typeName: 'Float'
            }),
            sequelize: {
                field:        config.sql,
                type:         Sequelize.DECIMAL(count, decimals),
                allowNull:    def === null || config.nullable,
                defaultValue: def,
            }
        }
    },
    Float(count, decimals, def, config) {
        if(typeof(def) === 'object' && def !== null) {
            config = def
            def = undefined
        } else if(config === undefined) {
            config = {}
        }

        return {
            graphql: graphConfig(config, {
                typeName: 'Float'
            }),
            sequelize: {
                field:        config.sql,
                type:         Sequelize.FLOAT(count, decimals),
                allowNull:    def === null,
                defaultValue: def,
            }
        }
    },
    DateTime(def, config) {
        if(typeof(def) === 'object' && def !== null) {
            config = def
            def = undefined
        } else if(config === undefined) {
            config = {}
        }

        return {
            graphql: graphConfig(config),
            sequelize: {
                field:        config.sql,
                type:         Sequelize.DATE,
                allowNull:    def === null,
                defaultValue: def === 'now' ? Sequelize.NOW : def,
            }
        }
    },
    Date: function(def, config) {
        if(this instanceof context.Date) {
            if(def && config)
                return new Date(def, config)
            else if(def)
                return new Date(def)
            else
                return new Date()
        }

        if(typeof(def) === 'object' && def !== null) {
            config = def
            def = undefined
        } else if(config === undefined) {
            config = {}
        }

        return {
            graphql: graphConfig(config),
            sequelize: {
                field:        config.sql,
                type:         Sequelize.DATEONLY,
                allowNull:    def === null,
                defaultValue: def === 'now' ? Sequelize.NOW : def,
            }
        }
    },
    Now() {
        return new Date()
    },
    Bool(def, config) {
        if(typeof(def) === 'object' && def !== null) {
            config = def
            def = undefined
        } else if(config === undefined) {
            config = {}
        }

        return {
            graphql: graphConfig(config, {
                typeName: 'Boolean'
            }),
            sequelize: {
                field:        config.sql,
                type:         Sequelize.BOOLEAN,
                allowNull:    def === null,
                defaultValue: def || false,
            }
        }
    },
    Enum() {
        var values = []
        var config = {}
        for(var val of arguments) {
            if(typeof(val) === 'string') {
                values.push(val)
            } else {
                config = val
                break
            }
        }

        return {
            graphql: graphConfig(config, {
                typeName: 'String'
            }),
            sequelize: {
                type:         Sequelize.ENUM.apply(Sequelize, values),
                allowNull:    config.nullable || false,
                defaultValue: config.nullable ? null : values[0]
            }
        }
    },
    JSON(config = {}) {
        return {
            // graphql: graphConfig(config, {
            //     typeName: 'Boolean'
            // }),
            graphql: null,
            sequelize: Object.assign({
                field:        config.sql,
                type:         Sequelize.JSON,
            }, config)
        }
    },
    Computed(type, fn) {
        return {
            graphql: {
                typeName: type,
                resolve: fn,
            },
        }
    },
    Session: Session,
    Params:  Params,
    plugins,
}

const srcContext = Path.join(process.cwd(), 'graphql', 'src', 'context.js')
if(fs.existsSync(srcContext))
    module.exports = Object.assign(context, require(srcContext)(context))
else
    module.exports = context

setResolverContext(module.exports)