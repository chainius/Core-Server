const cluster       = require('cluster');
const chalk         = require('chalk');
const subConsole    = console.create('Bundle');

const PagesManager  = plugins.require('vue/PagesManager');

module.exports = function(value, cb)
{
    if(value === undefined || value === null)
        value = 'client';

    if (['client', 'server'].indexOf(value) === -1)
    {
        subConsole.error('Wrong bundle type given', value);
        return false;
    }

    if (cluster.isMaster)
        subConsole.info('Bundle environment:', chalk.bold(process.env.NODE_ENV + '-' + value));

    var serverStart = Date.now();

    PagesManager.compile(value, function() {
        subConsole.info(value.substr(0,1).toUpperCase() + value.substr(1), 'bundle done (' + (Date.now() - serverStart) + ' ms)');

        if(cb)
            cb();
    })
    .on('bundle', function() {
        serverStart = Date.now();
    });

    return false;
};