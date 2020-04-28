class SiteManager extends SuperClass {

    getConfig(name) {
        if (this.configs[name])
            return this.configs[name];
        else if(process.env.NODE_ENV !== 'production')
            return super.getConfig(name);

        // Get config from prod path
        try {
            const prodPath = '/var/config/' + name + '.json';
            const fs       = require('fs');
    
            if (fs.existsSync(prodPath)) {
                const Crypter = plugins.require('http/Crypter')
                const config  = SiteManager.getConfigSecret()
                const content = fs.readFileSync(prodPath).toString();
                const res     = Crypter.decrypt(content, config.secret, config.iv);
    
                if(res) {
                    this.configs[name] = JSON.parse(res);
                    return this.configs[name]
                }
            }
        } catch(e) {
            console.error(e);
        }

        return super.getConfig(name);
    }

    static getConfigSecret() {
        const pkg = require(process.cwd() + '/package.json')
        if(pkg.iv && pkg.secret) {
            return {
                name:       pkg.k8sName || pkg.name,
                namespace:  pkg.namespace || 'default',
                secret:     pkg.secret,
                iv:         pkg.iv,
            }
        }

        const Crypter = plugins.require('http/Crypter')
        const hash    = Crypter.sha1Hex(pkg.name)

        return {
            name:       pkg.k8sName || pkg.name,
            namespace:  pkg.namespace || 'default',
            secret:     hash.substr(16),
            iv:         hash.substr(0, 16)
        }
    }

}

module.exports = SiteManager;