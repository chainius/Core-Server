const child_process = require('child_process')

function spawn(cwd) {
    if(!cwd)
        throw('No cwd specified')

    const ls = child_process.spawn('npm', ['install'], { cwd: cwd })

    ls.stdout.on('data', (data) => {
        process.stdout.write(data)
    })

    ls.stderr.on('data', (data) => {
        process.stderr.write(data)
    })

    ls.on('close', (code) => {
        if(code !== 0)
            console.log(cwd, `exited with code ${code}`)
    })
}

module.exports = function(value) {
    if(value !== 'plugins') {
        spawn(process.pwd())
        spawn(process.cwd())
    }

    for(var path in plugins.loadedPlugins) {
        spawn(path)
    }

    return false
}