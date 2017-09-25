const Stream    = require('stream');

class CacheStream extends Stream.Stream
{
    constructor(inputStream)
    {
        super({});

        this.writable = true;
        this.readable = true;

        this._buffers = [];
        this._dests   = [];
        this._ended   = false;

        const _this = this;
        inputStream.pipe(this);

        inputStream.once('readable', function()
        {
            _this.emit('readable', _this);
        });

        inputStream.on('error', function(err)
        {
            _this.emit('error', err);
        });
    }

    write(buffer)
    {
        this._buffers.push(buffer);
        this.emit('readable', this);

        this._dests.forEach(function(dest) {
            dest.emit('readable', dest);
            dest.write(buffer);
        });
    }

    pipe(dest, options)
    {
        if (options)
            throw Error('StreamCache#pipe: options are not supported yet.');

        try
        {
            if(this._buffers.length > 0)
                dest.emit('readable', this);

            this._buffers.forEach(function(buffer) {
                dest.write(buffer);
            });

            if (this._ended) {
                    dest.end();
                return dest;
            }

            this._dests.push(dest);
        }
        catch(e)
        {
            console.error(e);
        }

        return dest;
    }

    getLength()
    {
        return this._buffers.reduce(function(totalLength, buffer) {
            return totalLength + buffer.length;
        }, 0);
    }

    end()
    {
        this._dests.forEach(function(dest) {
            try
            {
                dest.end();
            }
            catch(e)
            {
                console.error(e);
            }
        });

        this._ended = true;
        this._dests = [];
    }
}

module.exports = CacheStream;

//--------------------------------
/*
class Test
{

    fromFile(name)
    {
        const fs = require('fs');
        var raw  = fs.createReadStream(name);

        const stream = new CacheStream(raw);

        stream.pipe(process.stdout);
    }

}

const test = new Test();

test.fromFile(__dirname + '/cacheObject.js');*/