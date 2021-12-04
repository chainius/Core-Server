const chalk = require('chalk')

function showCommands(category) {

    var maxLength = 15

    for(var key in category)
        maxLength = Math.max(maxLength, key.length + 3)

    for(var key in category) {
        var text = '    ' + key + ':'

        for(var i=key.length; i<maxLength; i++)
            text += ' '

        text += category[key]

        console.log(text)
    }

}

function show(Categories) {

    for(var cat in Categories) {

        console.log(chalk.bold(cat))
        showCommands(Categories[cat])
        console.log('')

    }

}

module.exports = function() {
    var Categories = {
        core: {
            production: "Run core-server in production mode",
            install:    "Install all core-server dependencie & the nested plugins",
            help:       "Show the help utility",
            version:    "Show the current nodejs and app version",
            test:       "Run testes using mocha",
            prune:      "Remove all dev dependencies"
        }
    }

    for(var key in plugins.loadedPlugins) {
        const plugin = plugins.loadedPlugins[key]

        if(!plugin.cli)
            continue

        if(!Categories[plugin.name])
            Categories[plugin.name] = {}

        const cat = Categories[plugin.name]

        //--------------------------------

        for(var x in plugin.cli) {
            const cli = plugin.cli[x]

            if(cat[x])
                cat[x] += "\n" + (cli.description || cli)
            else
                cat[x] = (cli.description || cli)
        }
    }

    console.log(chalk.red.bold('Core-Server --help'))
    console.log(chalk.red.bold('------------------\n'))

    show(Categories)

    return false
}