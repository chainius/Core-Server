const Path = require('path');

function getAppVersion(basePath) {
    try {
        return require(Path.join(basePath, 'package.json')).version || 'dev';
    } catch(e) {
        if(e.code === 'MODULE_NOT_FOUND')
            return 'dev';

        throw(e);
    }
}

module.exports = function() {

    console.log('Current app version:          ', getAppVersion(process.cwd()));
    console.log('Current core-server version:  ', getAppVersion(process.pwd()));
    console.log('Running node version:         ', process.version);

    return false;
}