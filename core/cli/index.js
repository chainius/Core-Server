const argv    = require('process-argv')();
const cluster = require('cluster');
const Path    = require('path');
const Console = require('../logs/console.js');
var console   = Console.create('CLI');


/*

//---------------------------------------------------------------------------------

if (cluster.isWorker && process.env.bundle)
{
    argv.options.bundle = process.env.bundle;
    argv.options.hot = true;
}

//---------------------------------------------------------------------------------

process.argvOptions = argv.options;

module.exports.exec = function()
{
    for (var key in argv.options)
    {
        if (['production', 'hot', 'port', 'secure'].indexOf(key) === -1)
        {
            const path = Path.join(__dirname, key + '.js');
            if (fs.existsSync(path))
            {
                const r = require(path);
                if (r(argv.options, argv) === false)

                    return false;
            }
            else
            {
                console.error('Invalid argument', key);
                process.exit(1);
            }
        }
    }

    return true;
};*/


class CLI {

    constructor() {
        this.setupArgv();
    }

    setupArgv() {
        if (argv.command === undefined)
            argv.command = '.';

        argv.options = argv.options || {};
        this.parseEnvironmentCLI();

        if (argv.options.production !== undefined)
            process.env.NODE_ENV = 'production';
        else if (!process.env.NODE_ENV)
            process.env.NODE_ENV = 'development';

        process.options = argv.options;
        const oldCwd    = process.cwd();
        process.cwd     = function() { return Path.resolve(oldCwd, argv.command) };
        process.pwd     = function() { return Path.dirname(process.argv[1]); };
        process.port    = argv.options.port ? argv.options.port : ((process.env.NODE_ENV === 'production') ? 8085 : 8080);
    }

    parseEnvironmentCLI() {
        try {
            const cliEnv = JSON.parse(process.env.cli);
            for(var key in cliEnv)
                argv.options[key] = cliEnv[key];
        }
        catch(e) {

        }
    }

    async execute(plugins) {
        for(var key in argv.options) {
            try {
                const cont = await this.executeCLI( plugins, key, argv.options[key] )

                if(!cont)
                    return false;
            }
            catch(e) {
                console.error(e);
                return false;
            }
        }

        return true;
    }

    async executeCLI(plugins, name, value) {

        for(var key in plugins.loadedPlugins) {
            const cli = plugins.loadedPlugins[key].cli;

            if(!cli)
                continue;

            if(cli[name]) {
                const res = await this.executeCliConfig(cli[name], key, name, value);
                if(!res)
                    return false;
            }
        }

        if(['help', 'docs', 'version', 'install'].indexOf(name) !== -1) {
            const result = require('./' + name + '.js')(value);
            if(result === false)
                return false;
        }

        return true;
    }

    async executeCliConfig(cliConfig, cliPath, name, value) {
        if(typeof(cliConfig) === 'object') {
            if(cliConfig.fake)
                return true;
        }

        const path = Path.join(cliPath, 'cli', name + '.js');
        const mod  = require(path);

        var result = mod(value);

        if(result.then)
            result = await result;

        return (result === false) ? false : true;
    }
}

module.exports = new CLI();