const fs = require('fs')
const Crypter = plugins.require('http/Crypter')
const Manager = plugins.require('http/SiteManager')
const config = Manager.getConfigSecret()

module.exports = function(path) {
    if(!path)
        throw('No path provided')

    const content = fs.readFileSync(path).toString()
    const decrypt = Crypter.decrypt(Buffer.from(content, 'base64'), config.secret, config.iv)
    console.log(decrypt)

    return false
}