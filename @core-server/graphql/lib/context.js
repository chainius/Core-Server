const Sequelize = require('sequelize')
const Model = Sequelize.Model
const { schemaDeffinition, graphConfig, camelize } = require('./typedeff.js')
const { createResolver, Session, Params, TransformOptions } = require('./resolver.js')

module.exports = {
    Schema(table, fields) {
        var hasGraphql = false
        var multiSelector = null
        var oneSelector = null
        var computedFields = {}
        var schema;

        const obj = {
            Query(options) {
                multiSelector = TransformOptions({
                    multi: options
                }, options)

                hasGraphql = true
                return this
            },
            QueryOne(options) {
                oneSelector = TransformOptions({
                    one: options
                }, options)

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
                            fields[name].sequelize.references = fields[name].foreign
                            fields[name].sequelize.referencesKey = 'id'
                        }

                        config[name] = fields[name].sequelize
                        if(fields[name].foreign)
                            foreignKeys[name] = fields[name].foreign
                    }
                }

                schema = Table.init(config, {
                    sequelize,
                    modelName: table,
                    freezeTableName: true,
                    timestamps: (config.updatedAt !== undefined && config.createdAt !== undefined),
                })

                return {
                    foreign: foreignKeys,
                    schema
                }
            },
            BuildGraphql(name = table) {
                if(!hasGraphql)
                    return null

                return {
                    definitions: [
                        schemaDeffinition(name, fields, computedFields)
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
                            resolve: createResolver(schema, multiSelector)
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
                            resolve: createResolver(schema, oneSelector)
                        } : null,
                    ].filter((o) => o !== null)
                }
            },
            Field(name, schema) {
                computedFields[name] = schema
                return this
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
                allowNull:    def === null,
                defaultValue: def === undefined ? '' : def,
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
    Int(def, config = {}) {
        return {
            graphql: graphConfig(config, {
                typeName: 'Int'
            }),
            sequelize: {
                field:        config.sql,
                type:         Sequelize.INTEGER,
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
    SmallInt(count, def, config) {
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
                allowNull:    def === null,
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
    Date(def, config) {
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
    Session: Session,
    Params:  Params,
}