const fs        = require('fs');
const CFClient  = require('cloudflare');
const Path      = require('path');

function getConfig()
{
    if (process.env.NODE_ENV === 'production')
    {
        const onlinePath = Path.join(process.cwd(), 'config', 'servers-online.json');
        if (fs.existsSync(onlinePath))
            return require(onlinePath);
    }

    return require(Path.join(process.cwd(), 'config', 'servers.json'));
}

const config = getConfig();

//--------------------------------------------------------------------------------------------

async function purgeAll(cloudflare)
{
    console.log("Purging cloudflare cache..");

    await cloudflare.deleteCache( config.cloudflare["zone-id"], {
        purge_everything: true
    });

    console.log('Cache successfully purged')
}

module.exports = async function(options)
{
    if(!config.cloudflare)
    {
        console.error('Cloudflare config not found');
        return false;
    }

    const action = options.cloudflare;
    const cloudflare = new CFClient(config.cloudflare);

    if(action === 'purge')
    {
        await purgeAll(cloudflare);
    }
    else
    {
        console.log('Cloudflare action not found: ' + action);
    }

    return false;
}