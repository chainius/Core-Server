const Console = require('../logs/index.js')
const Module = require('module')
const vm = require('vm')
const Path = require('path')

function makeRequireFunction(mod) {
    const Module = mod.constructor

    function require(path) {
        try {
            exports.requireDepth += 1
            return mod.require(path)
        } finally {
            exports.requireDepth -= 1
        }
    }

    function resolve(request) {
        return Module._resolveFilename(request, mod)
    }

    require.resolve = resolve

    require.main = process.mainModule

    // Enable support to add extra extension types.
    require.extensions = Module._extensions

    require.cache = Module._cache

    return require
}

function _compile(content, filename) {
    // create wrapper function
    Module.wrapper[0] = '(function (exports, require, module, __filename, __dirname, console, SuperClass) { '
    var wrapper = Module.wrap(content)
    Module.wrapper[0] = '(function (exports, require, module, __filename, __dirname) { '

    var compiledWrapper = vm.runInThisContext(wrapper, {
        filename:      filename,
        lineOffset:    0,
        displayErrors: true
    })

    var dirname = Path.dirname(filename)

    var DebugName = Path.basename(filename)
    DebugName = DebugName.substr(0, DebugName.length - Path.extname(DebugName).length)

    const require = makeRequireFunction(this)

    var result = compiledWrapper.call(this.exports, this.exports, require, this,
        filename, dirname, Console.create(DebugName), this.SuperClass)

    return result
}

const parent = module

exports.plugin = function(filename, SuperClass) {
    var module = new Module(filename, parent)
    module._compile = _compile
    module.SuperClass = SuperClass

    module.load(filename)

    return module.exports
}