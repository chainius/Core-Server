const EventEmitter = require('events').EventEmitter;
const Path         = require('path');
const sane         = require('sane');
const minimatch    = require("minimatch")

module.exports = function (b, opts) {
    if (!opts) opts = {};

    const sWatch  = sane(process.cwd(), { dot: false, watchman: true });
    var cache = b._options.cache;
    var pkgcache = b._options.packageCache;

    function changeDetected(filepath, root)
    {
        const fullpath = Path.join(root, filepath);
        const bulks    = BrowserifyRequiredBulks;

        for(var key in bulks)
        {
            if(minimatch(fullpath, bulks[key].path))
            {
                const id = bulks[key].file;
                if (cache) delete cache[id];
                if (pkgcache) delete pkgcache[id];

                //b.emit('file', fullpath);
                b.emit('file', id);
                b.emit('update', id);
            }
        }
    }

    sWatch.on('add', changeDetected);
    sWatch.on('delete', changeDetected);

    return b;
}