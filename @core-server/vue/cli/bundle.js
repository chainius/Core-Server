// const cluster       = require('cluster');
const chalk = require('chalk')
const subConsole = console.create('Bundle')

const PagesManager = plugins.require('vue/PagesManager')

module.exports = function(value, cb) {
    if(value === undefined || value === null)
        value = 'client'

    // if (cluster.isMaster)
    subConsole.info('Starting bundle in environment:', chalk.bold(process.env.NODE_ENV + '-' + value), 'for', value, 'use')

    var serverStart = Date.now()

    try {
        PagesManager.compile(value, function() {
            subConsole.info(value.substr(0,1).toUpperCase() + value.substr(1), 'bundle done (' + (Date.now() - serverStart) + ' ms)')

            if(cb)
                cb()
        })
            .on('bundle', function() {
                serverStart = Date.now()
            })
    } catch(e) {
        subConsole.error(e)
    }

    return false
}