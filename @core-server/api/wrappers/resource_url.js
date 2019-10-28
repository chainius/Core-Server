function getResource(name)
{
    try
    {
        return plugins.getEntry('http/MasterServer').siteManager.resourceManager.getObject(name);
    }
    catch (e)
    {
        console.error('getResource', e);
    }

    return false;
}

module.exports = function(name)
{
    if (name.substr(0, 1) !== '/')
        name = '/' + name;

    const index  = name.indexOf('?');
    var resource = null;

    if (index == -1)
    {
        resource = getResource(name);
        name += '?';
    }
    else
    {
        resource = getResource(name.substr(0, index));
        name += '&';
    }

    if (resource)
    {
        const hash = resource.getHash();
        if (!hash)
            return false;

        return name + hash;
    }

    return name;
};