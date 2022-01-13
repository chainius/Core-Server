
class Component {
    constructor() {
        this.parse = require('./index')
        this.resourceQuery = '?'
    }

    setAttributes(attrs) {
        this.resourceQuery = '?' + require('querystring').stringify(attrs)
    }

    callback(_, source) {
        console.log(source)
    }
}

var compo = new Component()

var res = compo.parse(`query {
    test {
        abc
    }
}

mutation($label: String!) {
    addTag(label: $label) {
        id
        label
    }
}`)