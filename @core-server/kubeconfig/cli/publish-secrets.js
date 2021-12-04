const fs = require('fs')
const Path = require('path')
const Crypter = plugins.require('http/Crypter')
const Manager = plugins.require('http/SiteManager')
const config = Manager.getConfigSecret()

function getFiles(path) {
    const files = fs.readdirSync(path)
    const res = {}
    
    for(var name of files) {
        const content = fs.readFileSync(Path.join(path, name)).toString()
        res[name] = Crypter.encrypt(content, config.secret, config.iv)
    }

    return res
}

module.exports = function(arg) {
    const files = getFiles(Path.join(process.cwd(), 'config', '_prod'))

    const args = ['create', 'secret', 'generic', config.name, '--namespace=' + (config.namespace || 'default'), '--dry-run', '-o=json'].concat( Object.keys(files).map((file) => "--from-literal=" + file + "=" + files[file]) )
    var spawn = require('child_process').execSync

    // kick off process of listing files
    var child = spawn('kubectl ' + args.join(' ') + ' | kubectl apply -f -')
    console.log(child.toString())

    return false
}