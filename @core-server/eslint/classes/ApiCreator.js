module.exports = SuperClass

if(process.env.NODE_ENV !== 'development')
    return

// Load eslint config
var config
try {
    config = require(process.cwd() + '/.eslintrc.js')
} catch(e) {
    if(e.code != 'MODULE_NOT_FOUND')
        console.error('could not load eslint config', e)

    return
}

// Import packages
const Linter = require("eslint").Linter
const { logger, mapper } = require('vite-plugin-eslint-logger/src/logger.js')
const linter = new Linter({ cwd: process.cwd() })
const fs = require('fs')

linter.defineParser('@babel/eslint-parser', require('@babel/eslint-parser'))

if(String.prototype.replaceAll === undefined) {
    String.prototype.replaceAll = function(search, replacement) {
        return this.split(search).join(replacement)
    }
}

// ESLint validator
function verify(path, data, config) {
    var filename = path
    var index = path.lastIndexOf("/")
    if(index >= 0)
        filename = filename.substring(index + 1)

    var res = linter.verifyAndFix(data, config, { filename })
    if(res.fixed && res.output) {
        fs.writeFileSync(path, res.output)
        return res.output
    } else if(res.messages.length == 0) {
        return data
    }

    res = mapper({
        filePath: path,
        messages: res.messages,
        source:   data,
    })

    for(var item of res)
        logger(item)

    throw('eslint failed')
}

// override api file reader
SuperClass.fileContent = function(path) {
    if (SuperClass.fileExists(path)) {
        var data = ""
        try {
            data = fs.readFileSync(path, 'utf8').toString()
        } catch (e) {
            console.error('fileContent', e)
            return false
        }

        if(path.substr(-3) != ".js")
            return data

        return verify(path, data, config)
    }

    return false
}