const fs = require('fs')
const { spawnSync } = require('child_process')

function prune(dir) {
    try {
        spawnSync("npm", ['prune', '--production'], {
            cwd:      dir,
            env:      process.env,
            stdio:    [process.stdin, process.stdout, process.stdout],
            encoding: 'utf-8'
        })
    } catch(e) {
        console.error(e)
    }
}

module.exports = function() {
    const corePackage = require(process.pwd() + '/package.json')
    const coreBackup = JSON.parse(JSON.stringify(corePackage))
    fs.writeFileSync(process.pwd() + '/package-backup.json', JSON.stringify(corePackage, null, 2))
    
    for(var plugin in plugins.projectConfig) {
        if(plugins.projectConfig[plugin] || !corePackage.pluginDependencies[plugin])
            continue

        for(var package in corePackage.pluginDependencies[plugin]) {
            delete corePackage.dependencies[package]
        }
    }

    fs.writeFileSync(process.pwd() + '/package.json', JSON.stringify(corePackage, null, 2))
    prune(process.pwd())
    prune(process.cwd())

    fs.writeFileSync(process.pwd() + '/package.json', JSON.stringify(coreBackup, null, 2))
    return false
}