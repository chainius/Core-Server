const fsWrapper = require('./fs.js')
const Path = require('path')

module.exports = function(dir, name) {
    if (name.toLowerCase() === 'fs')
        return fsWrapper

    var path
    try {
        return require(name)
    } catch(e) {
        if(e.code !== 'MODULE_NOT_FOUND') {
            throw(e)
        }

        path = Path.resolve(Path.join(process.cwd(), 'node_modules'), name)
        if(path === name) {
            throw(e)
        }
    }

    try {
        return require(path)
    } catch(e) {
        if(e.code !== 'MODULE_NOT_FOUND') {
            throw(e)
        }
    }

    path = Path.resolve(dir, name)
    return require(path)
}