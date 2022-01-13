import { withFragments } from './fragments'

export default function create_mutation(handler, attributes, selection, document, fragments) {
    return function(variables) {
        if(typeof(variables) !== "object" && variables !== null && variables !== undefined)
            throw('Exepected object argument containing all variables')

        // Prepare mutation query
        var query = {
            kind:                document.kind,
            operation:           document.operation,
            directives:          document.directives,
            variableDefinitions: [],
            selectionSet: {
                kind: "SelectionSet",
                selections: [ selection ]
            }
        }

        // Add all received variables
        if(variables) {
            for(var key in variables) {
                var deff = document.variableDefinitions.find((o) => o.variable.name.value == key)
                if(deff)
                    query.variableDefinitions.push(deff)
            }
        }

        // Execute graphql query throught handler
        return handler({
            query: withFragments(query, fragments),
            variables,
            attributes,
            stream: null,
            component: this,
        })
    }
}