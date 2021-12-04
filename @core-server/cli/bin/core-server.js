#!/usr/bin/env node

const lib = require('../lib/index.js')
const console = lib.logs.create('CLI')

lib.plugins.loadConfig()

lib.plugins.executeCLI().then(function(execute) {

    if(execute)
        plugins.createEntries()

}).catch(function(err) {

    console.error(err)

})