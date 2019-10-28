const Path = require('path');
const fs   = require('fs');

function checkAccess(path)
{
    //ToDo check if last character of working dir is / ?

    return (path.substr(0, process.cwd().length) === process.cwd());
}

function wrapFn(name, addSync)
{
    module.exports[name] = function(path)
    {
        path = Path.resolve(process.cwd(), path);

        if (!checkAccess(path))
            throw new Error('Access denied (file: ' + path + ')');

        arguments[0] = path;
        return fs[name].apply(fs, arguments);
    };

    if (addSync === false)
        return;

    module.exports[name + 'Sync'] = function(path)
    {
        path = Path.resolve(process.cwd(), path);

        if (!checkAccess(path))
            throw new Error('Access denied (file: ' + path + ')');

        arguments[0] = path;
        return fs[name + 'Sync'].apply(fs, arguments);
    };
}

function wrapFn2(name, addSync)
{
    module.exports[name] = function(path, path2)
    {
        path = Path.resolve(process.cwd(), path);
        path2 = Path.resolve(process.cwd(), path2);

        if (!checkAccess(path))
            throw new Error('Access denied (file: ' + path + ')');

        if (!checkAccess(path2))
            throw new Error('Access denied (file: ' + path2 + ')');

        arguments[0] = path;
        arguments[1] = path2;

        return fs[name].apply(fs, arguments);
    };

    if (addSync === false)
        return;

    module.exports[name + 'Sync'] = function(path, path2)
    {
        path = Path.resolve(process.cwd(), path);
        path2 = Path.resolve(process.cwd(), path2);

        if (!checkAccess(path))
            throw new Error('Access denied (file: ' + path + ')');

        if (!checkAccess(path2))
            throw new Error('Access denied (file: ' + path2 + ')');

        arguments[0] = path;
        arguments[1] = path2;

        return fs[name + 'Sync'].apply(fs, arguments);
    };
}

function wrapFn3(name, addSync)
{
    module.exports[name] = fs[name];

    if (addSync === false)
        return;

    module.exports[name + 'Sync'] = fs[name + 'Sync'];
}

wrapFn('access');
wrapFn('appendFile');
wrapFn('chmod');
wrapFn('chown');
wrapFn3('close');
wrapFn3('constants', false);
wrapFn('createReadStream', false);
wrapFn('exists');
wrapFn3('fchmod');
wrapFn3('fchown');
wrapFn3('fdatasync');
wrapFn3('fstat');
wrapFn3('fsync');
wrapFn3('ftruncate');
wrapFn3('futimes');
wrapFn('lchmod');
wrapFn('lchown');
wrapFn2('link');
wrapFn('lstat');
wrapFn('mkdir');
//wrapFn('mkdtemp');
wrapFn('open');
wrapFn3('read');
wrapFn('readdir');
wrapFn('readFile');
wrapFn('readlink');
wrapFn('realpath');
wrapFn2('rename');
wrapFn('rmdir');
wrapFn('stat');
wrapFn2('symlink');
wrapFn('truncate');
wrapFn('unlink');
wrapFn('unwatchFile');
wrapFn('utimes');
wrapFn('watch');
wrapFn('watchFile');
wrapFn3('write');

//--------------------------------------------------------------------------------------------------------------------------------

function purge(file)
{
    const relative = Path.relative(process.cwd(), file);
    const server   = plugins.getEntry('http/MasterServer');

    if (relative.substr(0, 10) !== 'resources/' || !server.siteManager)
        return;

    server.siteManager.purgeCache(relative);
}

module.exports.writeFile = function(file, data, options, callback)
{
    file = Path.resolve(process.cwd(), file);

    if (!checkAccess(file))
        throw new Error('Access denied (file: ' + file + ')');

    if (typeof (options) === 'function')
    {
        callback = options;
        options = {};
    }

    return fs.writeFile(file, data, options, function(err)
    {
        if (!err)
            purge(file);

        if(callback)
            callback.apply(this, arguments);
    });
};

module.exports.writeFileSync = function(file)
{
    file = Path.resolve(process.cwd(), file);

    if (!checkAccess(file))
        throw new Error('Access denied (file: ' + file + ')');

    arguments[0] = file;
    const result = fs.writeFileSync.apply(fs, arguments);
    purge(file);
    return result;
};

module.exports.createWriteStream = function(file)
{
    file = Path.resolve(process.cwd(), file);

    if (!checkAccess(file))
        throw new Error('Access denied (file: ' + file + ')');

    arguments[0] = file;
    const stream = fs.createWriteStream.apply(fs, arguments);

    stream.on('finish', function()
    {
        purge(file);
    });

    return stream;
};