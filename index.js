const Path         = require('path');
const plugins      = require('./core/plugins/index.js');
const Console      = require('./core/logs/console.js');
const console      = Console.create('Index');

plugins.loadConfig();

plugins.executeCLI().then(function(execute) {

    if(execute)
        plugins.createEntries();

}).catch(function(err) {

    console.error(err);

});