function camelize(str) {
  str = str.split('-').join(' ').split('_').join(' ').toLowerCase().split(' ').map((r) => {
    return r.substr(0,1).toUpperCase() + r.substr(1)
  }).join('')

  if(str.substr(-1, 1) == 's')
    return str.substr(0, str.length - 1)
  return str
}

module.exports = {
    camelize,

    schemaDeffinition(schemaName, fields) {

        // Serialize fields
        const gFields = []
        for(var name in fields) {
            if(!fields[name].graphql)
                continue

            const config = fields[name].graphql
            if(fields[name].foreign) {
              const foreign = fields[name].foreign
              if(name.substr(-3) == '_id')
                name = name.substr(0, name.length-3)

              config.typeName = camelize(foreign)
            }

            gFields.push({
                kind: "FieldDefinition",
                name: {
                  kind: "Name",
                  value: name
                },
                arguments: config.arguments || [],
                type: config.type || {
                  kind: "NamedType",
                  name: {
                    kind: "Name",
                    value: config.typeName || 'String',
                  }
                },
                directives: config.directives || []
            })
        }

        // Return object
        return {
            kind: "ObjectTypeDefinition",
            name: {
              kind: "Name",
              value: camelize(schemaName),
            },
            interfaces: [],
            directives: [],
            fields: gFields,
          }
    },

    graphConfig(config, deff = {}) {
        if(!config || config.graphql === false)
            return null

        return Object.assign(config.graphql || {}, deff)
    },

    getComputedFields(table, fields) {
      var res = null

      for(var key in fields) {
        const field = fields[key]
        if(!field.graphql || !field.graphql.resolve)
          continue

        res = res || {}
        res[key] = field.graphql.resolve
      }

      if(!res)
        return null

      return {
        type: {
          [camelize(table)]: res
        }
      }
    }

}