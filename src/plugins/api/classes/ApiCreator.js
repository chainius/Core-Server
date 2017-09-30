const fs            = require('fs');
const vm            = require('vm');
const Path          = require('path');
const Crypter       = plugins.require('web-server/Crypter');
const _require      = require('../wrappers/require.js');
const resource_url  = require('../wrappers/resource_url.js');

const funcStart = "func = async function() { " +
                    "var post = this.post; var session = this.session; var cookie = this.cookie; var _this = this; this.console = console;\n";

class ApiCreator {

    constructor(siteManager) {
        this.siteManager  = siteManager;
        this.nonExisting  = [];
        this.apiContextes = {};
        this.apis         = {};
    }

    create(path, name) {
        if (this.nonExisting.length > 10000)
            this.nonExisting = [];

        if (this.nonExisting.indexOf(path) >= 0)
            return false;

        var handler = this.createJsHandler(path + '.js', name);
        if (handler !== false)
            return { handler: handler, path: path + '.js' };

        handler = this.createSqlHandler(path + '.sql');
        if (handler !== false)
            return { handler: handler, path: path + '.sql' };

        if (process.env.NODE_ENV === 'production')
            this.nonExisting.push(path);

        return false;
    }

    createSqlHandler(path) {
        const sql = ApiCreator.fileContent(path);
        if(sql == false)
            return false;

        return async function()
        {
            return await this.query(sql);
        }
    }

    createJsHandler(path, name) {
        const source = ApiCreator.fileContent(path);
        if (source === false)
            return false;

        /*if (process.env.NODE_ENV !== "production")
        {
            if (!verifySource(path, source, name))
                return lintError;
        }*/

        try
        {
            const script = new vm.Script(funcStart + source + "\n }", {
                filename: path,
                lineOffset: -1,
                displayErrors: true
            });

            const context = this.createContext(path, name, this.siteManager.getApiContext(name) || {});
            script.runInContext(context);
            return context.func;
        }
        catch (e)
        {
            /*const index = e.stack.indexOf("\n    at Object.createJsHandler [as jsHandler]");
            if (index !== -1)
                e.stack = e.stack.substr(0, index);*/

            console.error(e);
        }

        return false;
    }

    //------------------------------------------

    createContext(path, name, contextIn) {

        //const ASyncQueue = require('../queue.js');

        if (this.apiContextes[path])
            return this.apiContextes[path];

        const context           = contextIn;
        context.func            = false;
        context.require         = _require;
        context.Crypter         = Crypter;
        context.__dirname       = Path.dirname(path);
        context.__filename      = path;
        context.setTimeout      = setTimeout;
        context.setInterval     = setInterval;
        context.resource_url    = resource_url;
        context.Buffer          = Buffer;
        context.plugins         = plugins;
        //context.ASyncQueue      = ASyncQueue;

        context.eval = function(code) {
            const script = new vm.Script(code, {
                filename: path,
                lineOffset: -1,
                displayErrors: true
            });

            return script.runInContext(context);
        };

        context.console = console.create(name);
        context.process = process;
        context.global  = context;

        vm.createContext(context);
        this.apiContextes[path] = context;
        return context;
    }
}

ApiCreator.fileExists = function(path)
{
    try
    {
        return fs.existsSync(path);
    }
    catch (e)
    {
        console.error('fileExists', e);
    }

    return false;
};

ApiCreator.fileContent = function(path)
{
    if (ApiCreator.fileExists(path))
    {
        try
        {
            return fs.readFileSync(path, 'utf8');
        }
        catch (e)
        {
            console.error('fileContent', e);
        }
    }

    return false;
}

module.exports = ApiCreator;