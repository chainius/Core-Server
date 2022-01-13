function hasFragment(selections, name) {
    for(var key in selections) {
        var selection = selections[key]
        if(selection.kind == "FragmentSpread" && selection.name.value === name)
            return true

        if(selection.selectionSet && hasFragment(selection.selectionSet.selections, name))
            return true
    }

    return false
}

export default function fragmentsInFilter(selection) {
    return function(fragment) {
        if(!selection.selectionSet)
            return false

        return hasFragment(selection.selectionSet.selections, fragment.name.value)
    }
}

export function withFragments(selection, fragments) {
    if(fragments.length === 0)
        return selection

    return {
        kind: 'Document',
        definitions: [
            selection,
        ].concat(fragments)
    }
}