const copydir = require('copy-dir');
const Path    = require('path');

module.exports = function(options)
{
    if (options.docs === 'generate')
    {
        var scripts = ['modules/siteManager.js', 'modules/sessionsManager.js', 'modules/api/environment.js', 'modules/crypter.js'];

        const spawn = require('child_process').spawn;

        const ls    = spawn('jsdoc', scripts.concat(['-t', './node_modules/ink-docstrap/template', '-d', 'docs']));

        ls.stdout.on('data', (data) =>
        {
            console.log(data.toString());
        });

        ls.stderr.on('data', (data) =>
        {
            console.error(data.toString());
        });

        return false;
    }

    if (options.docs === null)
        options.docs = 'core-docs';

    copydir.sync(Path.join(__dirname, '..', '..', 'docs'), Path.resolve(process.cwd(), options.docs));
    return false;
};