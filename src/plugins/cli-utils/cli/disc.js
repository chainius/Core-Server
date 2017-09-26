const disc          = require('disc');
const cluster       = require('cluster');
const chalk         = require('chalk');
const fs            = require('fs');
const subConsole    = console.create('DISC');
const Path          = require('path');

const PagesManager  = plugins.require('vue/PagesManager');

module.exports = function(value)
{
    if(value === undefined || value === null)
        value = 'client';

    if (['client', 'server'].indexOf(value) === -1)
    {
        subConsole.error('Wrong bundle type given', value);
        return false;
    }

    if (cluster.isMaster)
        subConsole.info('Disc environment:', chalk.bold(process.env.NODE_ENV + '-' + value));

    var serverStart = Date.now();

    PagesManager.compile('client', function() {
        subConsole.info(value.substr(0,1).toUpperCase() + value.substr(1), 'bundle done (' + (Date.now() - serverStart) + ' ms)');

        subConsole.log('Exporting bundle disc..');

        disc.bundle(fs.readFileSync(Path.join(process.cwd(), 'dist', 'bundle-client.js')),
        {
            mode: 'size'
        }, function(err, html)
        {
            if (err)
                throw err;

            fs.writeFileSync(Path.join(process.cwd(), 'dist', 'disc.html'), html);
            console.log('Disc.html added to the dist folder');
        });
    })
    .on('bundle', function() {
        serverStart = Date.now();
    });

    return false;
};