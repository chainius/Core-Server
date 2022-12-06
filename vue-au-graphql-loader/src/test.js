
class Component {
    constructor(options = {}) {
        this.plugin = require('./index').raw(options)
        this.resourceQuery = '?'
        this.options = {}
    }

    setAttributes(attrs) {
        this.resourceQuery = '?' + require('querystring').stringify(attrs)
    }

    parse(src) {
        return this.plugin.transform(src, this.resourceQuery)
    }
}

var compo = new Component({
    handler: '../src/addons/graphql'
})

var res = compo.parse(`query($id: String!) {
    test(simulation: $simulation, id: $id) {
        abc
    }
}

mutation($label: String!) {
    addTag(label: $label) {
        id
        label
    }
}`)

// console.log(res)