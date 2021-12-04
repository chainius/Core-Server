const EventEmitter = require('events').EventEmitter
const fs = require('fs')
const cluster = require('cluster')

function save(b, opts) {
    const file = b._options.cacheFile
    const cache = {
        cache:   b._options.cache,
        package: b._options.packageCache,
        styles:  b._options.stylesCache
    }

    fs.writeFileSync(file, JSON.stringify(cache))
}

module.exports = function (b, opts) {
    if (!opts) 
        opts = {}

    const em = new EventEmitter()

    var timeout = null

    b.once('bundle', function() {
        for(var key in b._options.cache) {
            b.emit('file', key)
        }

        b.on('file', function() {
            if(timeout !== null)
                clearTimeout(timeout)

            timeout = setTimeout(function() {
                save(b, opts)
            }, 1500)
        })
    })

    return em
}

function rm(cache, file) {
    delete cache.cache[file]

    if(cache.package[file])
        delete cache.package[file]

    if(cache.styles[file])
        delete cache.styles[file]
}

function verifyCache(cache, file) {
    const fileTime = (new Date(fs.statSync(file).mtime)).getTime()

    for(var key in cache.cache) {
        if(key.substr(0, 10) === '/snapshot/')
            continue

        try {
            const time = (new Date(fs.statSync(key).mtime)).getTime()

            if(time > fileTime)
                rm(cache, key)
        } catch(e) {
            rm(cache, key)
        }
    }
}

function verifyDeps(obj, existingFiles, notExisintg) {
    const add = []

    for(var key in obj.deps) {
        const path = obj.deps[key]
        
        if(existingFiles.indexOf(path) !== -1)
            continue
        
        if(notExisintg.indexOf(path) !== -1)
            return false
        
        if(fs.existsSync(path)) {
            existingFiles.push(path)
        } else {
            notExisintg.push(path)
            return false
        }
    }
    
    return true
}

module.exports.getCache = function(file) {    
    var cache = {
        cache:   {},
        package: {},
        styles:  {}
    }

    if(fs.existsSync(file) && !cluster.isMaster) {
        const cache2 = require(file)
        cache = {
            cache:   cache2.cache || {},
            package: cache2.package || {},
            styles:  cache2.styles || {}
        }
        
        try {
            verifyCache(cache, file)
            
            var existingFiles = Object.keys(cache.cache)
            var notExisintg = []

            for(var name in cache.cache) {
                if(!verifyDeps(cache.cache[name], existingFiles, notExisintg)) {
                    rm(cache, name)
                }
            }
        } catch(e) {
            console.error(e)
            
            cache.cache = {}
            cache.package = {}
            cache.styles = {}
        }
    }

    return cache
}