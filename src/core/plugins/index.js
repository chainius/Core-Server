const CLI     = require('../cli/index.js');
const Console = require('../logs/console.js');
const console = Console.create('PluginSystem');
const Path    = require('path');
const CustomRequire = require('./require.js');

class PluginSystem {

    constructor() {
        this.classes       = {};
        this.loadedPlugins = {};
        this.entries       = {};
    }

    registerPath(path) {
        if(this.loadedPlugins[path])
            return this.loadedPlugins[path];

        try {
            const config = require(Path.join(path, 'plugin.json'));
            config.name  = config.name || Path.basename(path);

            if(config.depencies) {
                for(var key in config.depencies)
                    this.register(config.depencies[key]);
            }

            this.loadedPlugins[path] = config;
            return config;
        }
        catch(e) {
            if(e.code === 'MODULE_NOT_FOUND') {
                const err = new Error('The requested plugin cloud not be found at: ' + path);
                err.code = 'PLUGIN_NOT_FOUND';
                throw(err);
            }
            else {
                throw(e);
            }
        }
    }

    register(name, path) {
        for(var key in this.loadedPlugins)
        {
            if(this.loadedPlugins[key].name === name)
                delete this.loadedPlugins[key];
        }

        if(!path)
            path = Path.join(process.pwd(), 'plugins', name);

        this.registerPath(path);
    }

    require(name) {
        if(this.classes[name])
            return this.classes[name];

        const FullName = name.split('/');

        if(FullName.length < 2)
        {
            const err = new Error('The requested class did not specify a base plugin name: ' + name);
            err.code = 'CLASS_WITHOUT_BASEPLUGIN';
            throw(err);
        }

        this.classes[name] = this.createClass(FullName.shift(), FullName.join('/'));
        return this.classes[name];
    }

    createClass(plugin, name) {
        for(var key in this.loadedPlugins) {
            if(this.loadedPlugins[key].name !== plugin)
                continue;

            if(this.loadedPlugins[key].classes[name] === undefined)
                continue;

            if(this.loadedPlugins[key].classes[name] !== null) {
                //ToDo find the highest superclass in order to show to right needed class in the warning
                console.warn('Warning a plugin requires slow down the process, please change:', plugin + '/' + name, 'to:', this.loadedPlugins[key].classes[name]);
                return this.getClass(this.loadedPlugins[key].classes[name]);
            }

            const path      = Path.join(key, 'classes', name + '.js');
            const BaseClass = CustomRequire.plugin(path);

            return this.createHeritedClass(BaseClass, this.loadedPlugins[key].name + '/' + name, name);
        }

        const err = new Error('The requested class could not be found: ' + plugin + '/' + name);
        err.code = 'CLASS_NOT_FOUND';
        throw(err);
    }

    createHeritedClass(BaseClass, name, className) {
        for(var key in this.loadedPlugins) {
            if(!this.loadedPlugins[key].classes)
                continue;

            if(this.loadedPlugins[key].classes[className] === name) {
                try {
                    //Create herited class
                    const path        = Path.join(key, 'classes', className + '.js');
                    BaseClass         = CustomRequire.plugin(path, BaseClass);

                    //Continue creating class with sub herited classes
                    BaseClass = this.createHeritedClass(BaseClass, this.loadedPlugins[key].name + '/' + className, className);
                }
                catch(e) {
                    const err = new Error('[' + this.loadedPlugins[key].name + '] ' + e.message);
                    err.code = e.code;
                    throw(err);
                }
            }
        }

        return BaseClass;
    }

    executeCLI() {
        return CLI.execute(this);
    }

    createEntries() {
        var result   = [];
        this.entries = {};

        for(var key in this.loadedPlugins) {
            const plugin = this.loadedPlugins[key];

            if(plugin.entry) {
                const Entry = this.require(plugin.name + '/' + plugin.entry);

                this.entries[ plugin.name + '/' + plugin.entry ] = new Entry({});
                result.push( this.entries[ plugin.name + '/' + plugin.entry ] );
            }
        }

        return result;
    }

    getEntry(name) {
        return this.entries[name];
    }

    //------------------------

    loadConfig() {
        var config = {};

        try {
            config = require(Path.join(process.cwd(), 'config', 'plugins.json'));
        } catch(e) {
            if(e.code !== 'MODULE_NOT_FOUND')
                throw(e);
        }

        //ToDo load git repositories

        this.loadFolderPlugins(Path.join(process.pwd(), 'plugins'), config);
        this.loadFolderPlugins(Path.join(process.cwd(), 'plugins'), config);

        try {
            this.register('core', Path.join(process.cwd(), 'core'));
        } catch(e) {
            if(e.code !== 'PLUGIN_NOT_FOUND')
                throw(e);
        }
    }

    loadFolderPlugins(path, config) {
        try {
            const fs = require('fs');
            const pluginNames = fs.readdirSync(path).filter(f => fs.statSync(path+"/"+f).isDirectory());

            for(var key in pluginNames) {
                const name = pluginNames[key];

                if(config[name] !== false)
                {
                    this.register(name, Path.join(path, name));
                }
            }
        }
        catch(e) {
            if(e.code !== "ENOENT")
                console.error(e);
        }
    }
}

module.exports = new PluginSystem();
global.plugins = module.exports;