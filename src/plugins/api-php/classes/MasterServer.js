const cluster = require('cluster');

if(cluster.isWorker)
{
    module.exports = SuperClass;
    return;
}

var BundleStarted = false;

class MasterServer extends SuperClass {

    constructor(config) {
        super(config);

        console.log('PHP Support enabled')
        this.startPhpBundler();
    }

    startPhpBundler() {
        if(BundleStarted)
            return;

        this.phpWorker = new SuperClass.Worker({
            cli: JSON.stringify({
                phpbundle: true,
                hot:    true
            }),
            NODE_ENV: process.env.NODE_ENV
        });
    }

}

module.exports = MasterServer;