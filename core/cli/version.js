/*const Path = require('path');
const fs   = require('fs');

module.exports = function(options, argv)
{
    if (!process.appversion)
    {
        process.appversion = 'dev';
        const fs            = require('fs');
        const versionPath   = Path.join(process.cwd(), 'VERSION');

        if (fs.existsSync(versionPath))
            process.appversion = fs.readFileSync(versionPath).toString();
    }

    if (options === undefined)
        return process.appversion;

    if (options.version !== undefined)
    {
        console.log('Current app version:', process.appversion);
        console.log('Running node version:', process.version);
        return false;
    }

    return process.appversion;
};*/

console.log('ToDo');

module.exports = function() {
    return false;
}