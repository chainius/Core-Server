const Path         = require('path');
const plugins      = require('./core/plugins/index.js');
const Console      = require('./core/logs/console.js');
const console      = Console.create('Index');

plugins.loadConfig();

/*const pluginNames = require('fs').readdirSync(Path.join(process.pwd(), 'plugins'));

pluginNames.forEach(name => {
    plugins.register(name);
});*/

plugins.executeCLI().then(function(execute) {

    if(execute) {
        const MasterServer = plugins.require("web-server/MasterServer");
        const site = new MasterServer({});
    }

}).catch(function(err) {

    console.error(err);

});