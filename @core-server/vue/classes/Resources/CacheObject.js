const Path = require('path')
const fs = require('fs')
const mime = require('mime-types')
const zlib = require('zlib')

const CStream = plugins.require('http/Resources/CacheStream')
const Watcher = plugins.require('http/Watcher')
const Crypter = plugins.require('http/Crypter')

class CacheObject {
    constructor(path, streamCreator) {
        if(streamCreator)
            this.createReadStream = streamCreator

        this.mime = mime.contentType(Path.extname(path))
        this.path = Path.normalize(path)
        this.purge()

        const that = this
        Watcher.onFileChange(this.path, function() {
            that.purge()
            that.load()
        })
    }

    purge() {
        this.stream = null
        this.gzip = false
        this.deflate = false
        this.error = false
        this.hash = false

        /* this.loaded     = false;
        this.content    = false;
        this.isLoading  = false;*/

        this.load()
    }

    createReadStream() {
        return fs.createReadStream(this.path)
    }

    load() {
        this.exists = fs.existsSync(this.path)

        if(!this.exists)
            return

        const raw = this.createReadStream()
        this.stream = new CStream(raw)

        const _this = this
        raw.on('error', function(e) {
            _this.error = e
            _this.stream.emit('error', e)
        })
    }

    //------------------------------------------------------------------------

    linkPipes(src, dest) {
        /* src.once('readable', function(e)
        {
            try
            {
                dest.emit('readble', e);
            }
            catch(e)
            {
                _console.error(e);
            }
        });*/

        function onError(e) {
            try {
                dest.emit('error', e)
            } catch(e) { /* _console.error(e);*/ }
        }

        src.once('error', onError)
        dest.once('finish', function(e) {
            src.removeListener('error', onError)
        })

        return src.pipe(dest)
    }

    pipe(dest) {
        try {
            if (this.error) {
                dest.emit('error', this.error)
                return dest
            }

            return this.linkPipes(this.stream, dest)
        } catch(e) {
            console.error(e)
            return false
        }
    }

    pipeGZip(dest) {
        try {
            if (this.error) {
                dest.emit('error', this.error)
                return dest
            }

            if (!this.gzip) {
                const zipStream = this.pipe( zlib.createGzip() )
                this.gzip = new CStream(zipStream)
            }

            return this.linkPipes( this.gzip, dest )
        } catch(e) {
            console.error(e)
            return false
        }
    }

    pipeDeflate(dest) {
        try {
            if (this.error) {
                dest.emit('error', this.error)
                return dest
            }

            if (!this.deflate) {
                const deflStream = this.pipe( zlib.createDeflate() )
                this.deflate = new CStream(deflStream)
            }

            return this.linkPipes( this.deflate, dest )
        } catch(e) {
            console.error(e)
            return false
        }
    }

    //------------------------------------------------------------------------

    getHash() {
        try {
            if (this.hash)
                return this.hash

            if(this.error)
                return false

            if (fs.existsSync(this.path)) {
                const content = fs.readFileSync(this.path)
                this.hash = Crypter.sha1(content)
            }

            return this.hash
        } catch (e) {
            console.error(e)
        }

        return false
    }
}

module.exports = CacheObject

//------------------------------------------------------------------------

/* class Test
{

    streamOutput(path)
    {
        const object = new cacheObject(path);
        object.pipe(process.stdout);
    }

    streamGZip(path)
    {
        const object = new cacheObject(path);
        object.pipeGZip(process.stdout);
    }

    streamDeflate(path)
    {
        const object = new cacheObject(path);
        object.pipeDeflate(process.stdout);
    }

    hash(path)
    {
        const object = new cacheObject(path);
        console.log( object.getHash() );
    }

    catch404(path)
    {
        const object = new cacheObject(path);
        const pipe = object.pipe(process.stdout);

        pipe.on('error', function(e)
        {
            console.error(e);
        })
    }
}

const test = new Test();*/
// test.hash(__dirname + '/index.js');
// test.catch404(__dirname + '/index3.js');