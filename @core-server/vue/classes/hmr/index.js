'use strict'

var path = require('path')
var cproc = require('child_process')
var through = require('through2')
var convert = require('convert-source-map')
var EventEmitter = require('events').EventEmitter
var sm = require('source-map')
var crypto = require('crypto')
var fs = require('fs')
var _ = require('lodash')
var RSVP = require('rsvp')
var readFile = RSVP.denodeify(fs.readFile)
var has = require('./has.js')
var synchd = require('synchd')
const SocketServer = plugins.require('vue/hmr/socket-server')

function hashStr(str) {
    var hasher = crypto.createHash('sha256')
    hasher.update(str)
    return hasher.digest('base64').slice(0, 20)
}

var readManagerTemplate = _.once(function () {
    return readFile(path.join(__dirname, 'hmr-manager-template.js'), 'utf8')
})

function makeIdentitySourceMap(content, resourcePath) {
    var map = new sm.SourceMapGenerator()
    map.setSourceContent(resourcePath, content)
    content.split('\n').map(function (line, index) {
        map.addMapping({
            source:   resourcePath,
            original: {
                line:   index + 1,
                column: 0
            },
            generated: {
                line:   index + 1,
                column: 0
            }
        })
    })
    return map.toJSON()
}

function readOpt(opts, long, short, defval) {
    return has(opts, long) ? opts[long] : (short && has(opts, short)) ? opts[short] : defval
}

function boolOpt(value) {
    return Boolean(value && value !== 'false')
}



module.exports = function (bundle, opts) {
    if (!opts) 
        opts = {}

    var updateCacheBust = boolOpt(readOpt(opts, 'cacheBust', 'b', false))
    var bundleKey = readOpt(opts, 'key', 'k', 'ws:core-server')
    var ignoreUnaccepted = boolOpt(readOpt(opts, 'ignoreUnaccepted', null, true))

    var basedir = opts.basedir !== undefined ? opts.basedir : process.cwd()
    var em = new EventEmitter()

    var sioPath = './apiManager.js'// + path.relative(basedir, './resources/core-lib/client/apiManager.js');

    var server = new SocketServer()
    var serverCommLock = {}

    var currentModuleData = {}

    function setNewModuleData(moduleData) {
        var newModuleData = _.chain(moduleData)
            .toPairs()
            .filter(function (pair) {
                return pair[1].isNew
            })
            .map(function (pair) {
                return [pair[0], {
                    index:   pair[1].index,
                    hash:    pair[1].hash,
                    source:  pair[1].source,
                    parents: pair[1].parents,
                    deps:    pair[1].deps
                }]
            })
            .fromPairs()
            .value()
        var removedModules = _.chain(currentModuleData)
            .keys()
            .filter(function (name) {
                return !has(moduleData, name)
            })
            .value()
        currentModuleData = moduleData

        // This following block talking to the server should execute serially,
        // never concurrently.
        return synchd.synchd(serverCommLock, function () {
            return Object.keys(newModuleData).reduce(function (promise, name) {
                return promise.then(function () {
                    return new RSVP.Promise(function (resolve, reject) {
                        server.newModule(name, newModuleData[name])
                        resolve()
                    })
                })
            }, RSVP.Promise.resolve()).then(function () {
                return new RSVP.Promise(function (resolve, reject) {
                    server.removedModules(removedModules)
                    resolve()
                })
            })
        })
    }

    function fileKey(filename) {
        return path.relative(basedir, filename)
    }

    var hmrManagerFilename

    // keys are filenames, values are {hash, transformedSource}
    var transformCache = {}

    function setupPipelineMods() {
        var originalEntries = []

        bundle.pipeline.get('record').push(through.obj(function (row, enc, next) {
            if (row.entry) {
                originalEntries.push(row.file)
                next(null)
            } else {
                next(null, row)
            }
        }, function (next) {

            var source = [sioPath, 'lodash/forEach', 'lodash/some', 'lodash/map', 'lodash/filter', 'lodash/forOwn', 'lodash/mapValues', 'lodash/assign'].filter(Boolean).concat(originalEntries).map(function (name) {
                return 'require(' + JSON.stringify(name) + ');\n'
            }).join('')

            // Put the hmr file name in basedir to prevent this:
            // https://github.com/babel/babelify/issues/85
            const Path = require('path')
            hmrManagerFilename = Path.join(__dirname, '..', '..', 'modules-www', 'client', 'hmr.js')// path.join(basedir, '__hmr_manager.js');

            this.push({
                entry:   true,
                expose:  false,
                basedir: basedir,
                file:    hmrManagerFilename,
                id:      hmrManagerFilename,
                source:  source,
                order:   0
            })

            next()
        }))

        var moduleMeta = {}

        function makeModuleMetaEntry(name) {
            if (!has(moduleMeta, name)) {
                moduleMeta[name] = {
                    index:   null,
                    hash:    null,
                    parents: []
                }
            }
        }

        bundle.pipeline.get('deps').push(through.obj(function (row, enc, next) {
            if (row.file !== hmrManagerFilename) {
                makeModuleMetaEntry(fileKey(row.file))
                _.forOwn(row.deps, function (name, ref) {
                    // dependencies that aren't included in the bundle have the name false
                    if (name) {
                        makeModuleMetaEntry(fileKey(name))
                        moduleMeta[fileKey(name)].parents.push(fileKey(row.file))
                    }
                })
            }

            next(null, row)
        }))

        var moduleData = {}
        var newTransformCache = {}
        var managerRow = null
        var rowBuffer = []

        if (bundle.pipeline.get('dedupe').length > 1) {
            console.warn("[HMR] Warning: other plugins have added dedupe transforms. This may interfere.")
        }

        // Disable dedupe transforms because it screws with our change tracking.
        bundle.pipeline.splice('dedupe', 1, through.obj())

        bundle.pipeline.get('label').push(through.obj(function (row, enc, next) {

            if(!row) {
                next(null)
            } else if (row.file === hmrManagerFilename) {
                managerRow = row
                next(null)
            } else {
                // row.id used when fullPaths flag is used
                moduleMeta[fileKey(row.file)].index = has(row, 'index') ? row.index : row.id

                var hash = moduleMeta[fileKey(row.file)].hash = hashStr(row.source)
                var originalSource = row.source
                var isNew, thunk
                if (has(transformCache, row.file) && transformCache[row.file].hash === hash) {
                    isNew = false
                    row.source = transformCache[row.file].transformedSource
                    newTransformCache[row.file] = transformCache[row.file]
                    thunk = _.constant(row)
                } else {
                    isNew = true
                    thunk = function () {
                        var header = '_hmr[' + JSON.stringify(bundleKey) +
                            '].initModule(' + JSON.stringify(fileKey(row.file)) + ', module);\n(function(){\n'
                        var footer = '\n}).apply(this, arguments);\n'

                        var inputMapCV = convert.fromSource(row.source)
                        var inputMap
                        if (inputMapCV) {
                            inputMap = inputMapCV.toObject()
                            row.source = convert.removeComments(row.source)
                        } else {
                            inputMap = makeIdentitySourceMap(row.source, path.relative(basedir, row.file))
                        }

                        var node = new sm.SourceNode(null, null, null, [
                            new sm.SourceNode(null, null, null, header),
                            sm.SourceNode.fromStringWithSourceMap(row.source, new sm.SourceMapConsumer(inputMap)),
                            new sm.SourceNode(null, null, null, footer)
                        ])

                        var result = node.toStringWithSourceMap()
                        row.source = result.code + convert.fromObject(result.map.toJSON()).toComment()

                        newTransformCache[row.file] = {
                            hash:              hash,
                            transformedSource: row.source
                        }
                        return row
                    }
                }

                moduleData[fileKey(row.file)] = {
                    isNew:   isNew,
                    index:   moduleMeta[fileKey(row.file)].index,
                    hash:    hash,
                    source:  originalSource,
                    parents: moduleMeta[fileKey(row.file)].parents,
                    deps:    row.indexDeps || row.deps
                }

                // Buffer everything so we can get the websocket stuff done sooner
                // without being slowed down by the final bundling.
                rowBuffer.push(thunk)
                next(null)
            }
        }, function (done) {
            var self = this

            transformCache = newTransformCache
            setNewModuleData(moduleData).then(function () {
                return readManagerTemplate()
            }).then(function (mgrTemplate) {
                rowBuffer.forEach(function (thunk) {
                    self.push(thunk())
                })

                managerRow.source = mgrTemplate
                    .replace('null/*!^^moduleMeta*/', _.constant(JSON.stringify(moduleMeta)))
                    .replace('null/*!^^originalEntries*/', _.constant(JSON.stringify(originalEntries)))
                    .replace('null/*!^^ignoreUnaccepted*/', _.constant(JSON.stringify(ignoreUnaccepted)))
                    .replace('null/*!^^bundleKey*/', _.constant(JSON.stringify(bundleKey)))
                    .replace('null/*!^^sioPath*/', _.constant(JSON.stringify(sioPath)))

                self.push(managerRow)
            }).then(done, done)
        }))
    }
    setupPipelineMods()

    bundle.on('reset', setupPipelineMods)
    return em
}
