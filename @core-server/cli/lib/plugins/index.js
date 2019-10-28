const CLI     = require('../cli/index.js');
const Console = require('../logs/index.js');
const console = Console.create('PluginSystem');
const Path    = require('path');
const CustomRequire = require('./require.js');
const Module  = require('module');
const fs      = require('fs');

class PluginSystem {

    constructor() {
        this.classes       = {};
        this.loadedPlugins = {};
        this.entries       = {};
    }
    
    get config() {
        return this.loadedPlugins;
    }

    autoGetParent(clsName) {
        for(var key in this.loadedPlugins) {
            const plugin = this.loadedPlugins[key];
            if(plugin.classes && plugin.classes[clsName] !== undefined)
                return plugin.name + '/' + clsName;
        }

        return null;
    }

    registerPath(path) {
        if(this.loadedPlugins[path])
            return this.loadedPlugins[path];

        var config = {};
        try {
            config = require(Path.join(path, 'plugin.json'));
        }
        catch(e) {
            if(e.code !== 'MODULE_NOT_FOUND') {
                /*const err = new Error('The requested plugin cloud not be found at: ' + path);
                err.code = 'PLUGIN_NOT_FOUND';
                throw(err);
            }
            else {*/
                throw(e);
            }
        }

        config.name  = config.name || Path.basename(path);

        if(!config.classes) {
            //Auto discover
            try {
                const classes = fs.readdirSync(Path.join(path, 'classes')).filter(f => f.substr(-3) === '.js' && !fs.statSync(Path.join(path, 'classes', f)).isDirectory());
                if(classes.length > 0)
                    config.classes = {};

                for(var name of classes) {
                    name = name.substr(0, name.length - 3);
                    config.classes[name] = this.autoGetParent(name);
                }
            } catch(e) {
                if(e.code !== "ENOENT" && e.code !== "ENOTDIR")
                    console.error(e);
            }
        }

        if(!config.cli) {
            //Auto discover

            try {
                const clis = fs.readdirSync(Path.join(path, 'cli')).filter(f => f.substr(-3) === '.js' && !fs.statSync(Path.join(path, 'cli', f)).isDirectory());
                if(clis.length > 0)
                    config.cli = {};

                for(var name of clis) {
                    config.cli[name.substr(0, name.length-3)] = 'No description provided';
                }
                
            } catch(e) {
                if(e.code !== "ENOENT" && e.code !== "ENOTDIR")
                    console.error(e);
            }
        }

        if(config.depencies) {
            for(var key in config.depencies)
                this.register(config.depencies[key]);
        }

        this.loadedPlugins[path] = config;
        return config;
    }

    register(name, path) {
        for(var key in this.loadedPlugins) {
            if(this.loadedPlugins[key].name === name)
                delete this.loadedPlugins[key];
        }

        if(!path)
            path = Path.join(process.pwd(), 'src', 'plugins', name);

        this.registerPath(path);
    }
    
    watch(path) {
        var watcher = null; 

        if (process.env.NODE_ENV === 'production')
            return;
        
        this.watchings = this.watchings || [];
        
        if(this.watchings.indexOf(path) !== -1)
            return;
        
        this.watchings.push(path);
        
        try {
            watcher = this.require('http/Watcher');
        } catch(e) {
            if(e.code === 'CLASS_NOT_FOUND')
                return;

            throw(e);
        }

        if(watcher === null)
            return;

        watcher.onChange(path, (filePath) => {
            this.classes       = {};
            this.loadedPlugins = {};

            this.loadConfig();

            if(Module._cache[filePath])
                delete Module._cache[filePath];
            
            console.warn('Deleted plugins cache');
        });
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
                const FullName = this.loadedPlugins[key].classes[name].split('/');
                return this.createClass(FullName.shift(), FullName.join('/'));
            }

            const path      = Path.join(key, 'classes', name + '.js');
            const BaseClass = CustomRequire.plugin(path);
            
            //this.watch(plugin + '/' + name, path);

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

            for(var subClass in this.loadedPlugins[key].classes)
            {
                if(this.loadedPlugins[key].classes[subClass] === name) {
                    try {
                        //Create herited class
                        const path        = Path.join(key, 'classes', subClass + '.js');
                        BaseClass         = CustomRequire.plugin(path, BaseClass);
                        
                        //this.watch(name, path);

                        //Continue creating class with sub herited classes
                        BaseClass = this.createHeritedClass(BaseClass, this.loadedPlugins[key].name + '/' + className, className);
                    }
                    catch(e) {
                        //e.message = '[' + this.loadedPlugins[key].name + '/' + className + '] ' + e.message;
                        //console.error(e);
                        //const err = new Error('[' + this.loadedPlugins[key].name + '/' + className + '] ' + e.message);
                        //err.code = e.code;
                        throw(e);
                    }
                }
            }
        }

        return BaseClass;
    }

    createExtendedClass(BaseClass, NClassPath) {
        if(typeof(BaseClass) === 'string')
            BaseClass = this.require(BaseClass);

        return CustomRequire.plugin(NClassPath, BaseClass);
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

    getProjectConfig(name) {
        try {
            if (process.env.NODE_ENV === 'production')
            {
                const fs = require('fs');
                const onlinePath = Path.join(process.cwd(), 'config', name + '-production.json');
                if (fs.existsSync(onlinePath))
                    return require(onlinePath);
            }

            return require(Path.join(process.cwd(), 'config', name + '.json'));
        } catch(e) {
            console.error(e);
        }
        
        return {};
    }
    
    loadConfig() {
        const config = {};

        // Load plugins config
        try {
            const subConfig = require(Path.join(process.cwd(), 'config', 'plugins.json'));

            for(var key in subConfig)
                config[key] = subConfig[key];
        } catch(e) {
            if(e.code !== 'MODULE_NOT_FOUND')
                throw(e);
        }

        this.projectConfig = config;

        // Load installed packages
        try {
            const app = require(Path.join(process.cwd(), 'package.json'));
            const dependencies = Object.assign({}, app.dependencies, app.devDependencies, app.peerDependencies)

            for(var key in dependencies) {
                if(config[key] === false)
                    continue

                try {
                    if(fs.existsSync(Path.join(process.cwd(), 'node_modules', key, 'plugin.json')))
                        this.register(key, Path.join(process.cwd(), 'node_modules', key), config[key] || {});
                } catch(e) {
                    if(e.code !== 'PLUGIN_NOT_FOUND')
                        throw(e);
                }
            }

        } catch(e) {
            if(e.code !== 'MODULE_NOT_FOUND')
                throw(e);
        }

        // Add project plugins
        this.loadFolderPlugins(Path.join(process.cwd(), 'plugins'), config);

        try {
            // Add project core folder as being core plugin
            if(fs.existsSync(Path.join(process.cwd(), 'core')))
                this.register('core', Path.join(process.cwd(), 'core'));
        } catch(e) {
            if(e.code !== 'PLUGIN_NOT_FOUND')
                throw(e);
        }
    }

    loadFolderPlugins(path, config) {
        try {
            const pluginNames = fs.readdirSync(path).filter(f => fs.statSync(path+"/"+f).isDirectory());

            for(var key in pluginNames) {
                const name = pluginNames[key];

                if(config[name] !== false) {
                    this.register(name, Path.join(path, name));
                }
            }
        }
        catch(e) {
            if(e.code !== "ENOENT")
                console.error(e);
        }

        this.watch(path);
    }
}

module.exports = new PluginSystem();
global.plugins = module.exports;