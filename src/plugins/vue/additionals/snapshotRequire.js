const EventEmitter = require('events').EventEmitter;
const through = require('through2');
const fs = require('fs');

module.exports = function (bundle, opts) {
    if (!opts) opts = {};
    const em = new EventEmitter();

    bundle.pipeline.get('record').push(through.obj(function (row, enc, next)
    {
        if(!row.file)
            return next(null, row);

        if(row.file.substr(0, 10) !== '/snapshot/')
            return next(null, row);

        this.push({
            entry: row.entry,
            expose: row.expose,
            basedir: row.basedir,
            file: row.file,
            id: row.id,
            source: fs.readFileSync(row.file),
            order: row.order
        });

        next(null);
    },
    function (next, row)
    {
        next();
    }));

    return em;
}
