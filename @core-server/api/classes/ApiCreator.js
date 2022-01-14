const fs = require('fs')
const vm = require('vm')
const Path = require('path')
const Crypter = plugins.require('http/Crypter')
const _require = require('../wrappers/require.js')

const funcStart = "func = async function {@name}(console, __filename, __dirname) { " +
                    "const require = $__require.bind(this, __dirname); var post = this.post; var session = this.session; var cookie = this.cookie; var _this = this; this.console = console;\n"

class ApiCreator {

    constructor(siteManager) {
        this.siteManager = siteManager
        this.nonExisting = []
        this.apis = {}
        this.context = null
    }

    create(path, name) {
        if (this.nonExisting.length > 10000)
            this.nonExisting = []

        if (this.nonExisting.indexOf(path) >= 0)
            return false

        var handler = this.createJsHandler(path + '.js', name)
        if (handler !== false)
            return { handler: handler, path: path + '.js', dirname: Path.dirname(path + '.js'), console: console.create(name) }

        handler = this.createSqlHandler(path + '.sql')
        if (handler !== false)
            return { handler: handler, path: path + '.sql', dirname: Path.dirname(path + '.sql') }

        if (process.env.NODE_ENV !== 'development')
            this.nonExisting.push(path)

        return false
    }

    createSqlHandler(path) {
        const sql = ApiCreator.fileContent(path)
        if(sql == false)
            return false

        return async function() {
            return await this.query(sql)
        }
    }

    createJsHandler(path, name) {
        const source = ApiCreator.fileContent(path)
        if (source === false)
            return false

        try {
            const script = new vm.Script(funcStart.replace("{@name}", camelize(name)) + source + "\n }", {
                filename:      path,
                lineOffset:    -1,
                displayErrors: true
            })

            if(!this.context)
                this.context = this.createContext(this.siteManager.getApiContext() || {})

            script.runInContext( this.context )
            const fn = this.context.func
            this.context.func = null
            return fn
        } catch (e) {
            /* const index = e.stack.indexOf("\n    at Object.createJsHandler [as jsHandler]");
            if (index !== -1)
                e.stack = e.stack.substr(0, index);*/

            console.error(e)
        }

        return false
    }

    //------------------------------------------

    createApiContext(path, name, contextIn) {
        if (this.apiContextes[path])
            return this.apiContextes[path]
        
        this.apiContextes[path] = this.createContext(contextIn)
        return this.apiContextes[path]
    }

    createContext(contextIn) {
        // const ASyncQueue = require('../queue.js');

        const context = contextIn
        context.func = false
        context.$__require = _require
        context.Crypter = Crypter
        context.setTimeout = setTimeout
        context.setInterval = setInterval
        context.setImmediate = setImmediate
        context.clearTimeout = clearTimeout
        context.clearInterval = clearInterval
        context.clearImmediate = clearImmediate
        context.Buffer = Buffer
        context.plugins = plugins
        // context.ASyncQueue      = ASyncQueue;
        context.process = process
        context.global = context
        
        context.eval = function(code) {
            const script = new vm.Script(code, {
                filename:      'ApiEval',
                lineOffset:    -1,
                displayErrors: true
            })

            return script.runInContext(context)
        }

        vm.createContext(context)
        return context
    }
}

ApiCreator.fileExists = function(path) {
    try {
        return fs.existsSync(path)
    } catch (e) {
        console.error('fileExists', e)
    }

    return false
}

ApiCreator.fileContent = function(path) {
    if (ApiCreator.fileExists(path)) {
        try {
            return fs.readFileSync(path, 'utf8')
        } catch (e) {
            console.error('fileContent', e)
        }
    }

    return false
}

module.exports = ApiCreator

function camelize(str) {
    return str.replace(/[^a-zA-Z\d\s:]/g, ' ').replace(/(?:^\w|[A-Z]|\b\w)/g, function(word, index) {
        return word.toUpperCase()
    }).replace(/\s+/g, '')
}