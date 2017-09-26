const Path    = require('path');
const fs      = require('fs');

function getScripts() {
    var scripts = [];

    for(var path in plugins.loadedPlugins) {
        const plugin = plugins.loadedPlugins[path];

        if(!plugin.classes)
            continue;

        for(var name in plugin.classes)
            scripts.push( Path.join(path, 'classes', name + '.js') );
    }

    return scripts;
}

module.exports = function(value)
{
    const scripts = getScripts();

    const spawn  = require('child_process').spawn;
    const output = Path.join(process.cwd(), value || 'docs');

    const tmpPath1 = Path.join(process.pwd(), 'node_modules', 'ink-docstrap', 'template');
    const templatePath = fs.existsSync(tmpPath1) ? tmpPath1 : Path.join(__dirname, '..', 'node_modules', 'ink-docstrap', 'template');
    const ls     = spawn('jsdoc', scripts.concat(['-t', templatePath, '-d', output]));

    console.log('Generating docs to', output);

    ls.stdout.on('data', (data) =>
    {
        console.log(data.toString());
    });

    ls.stderr.on('data', (data) =>
    {
        console.error(data.toString());
    });

    return false;
};