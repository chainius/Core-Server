'use strict'

function has(object, propName) {
    return Object.prototype.hasOwnProperty.call(object, propName)
}

function StrSet(other) {
    this._map = {}
    this._size = 0
    if (other) {
        for (var i=0,len=other.length; i<len; i++) {
            this.add(other[i])
        }
    }
}
StrSet.prototype.add = function(value) {
    if (!this.has(value)) {
        this._map[value] = true
        this._size++
    }
}
StrSet.prototype.has = function(value) {
    return has(this._map, value)
}
StrSet.prototype.del = function(value) {
    if (this.has(value)) {
        delete this._map[value]
        this._size--
    }
}
StrSet.prototype.size = function() {
    return this._size
}
StrSet.prototype.forEach = function(cb) {
    for (var value in this._map) {
        if (has(this._map, value)) {
            cb(value)
        }
    }
}
StrSet.prototype.some = function(cb) {
    for (var value in this._map) {
        if (has(this._map, value)) {
            if (cb(value)) {
                return true
            }
        }
    }
    return false
}
StrSet.prototype.hasIntersection = function(otherStrSet) {
    var value
    if (this._size < otherStrSet._size) {
        return this.some(function(value) {
            return otherStrSet.has(value)
        })
    } else {
        var self = this
        return otherStrSet.some(function(value) {
            return self.has(value)
        })
    }
}
StrSet.prototype.toArray = function() {
    var arr = []
    this.forEach(function(value) {
        arr.push(value)
    })
    return arr
}

module.exports = StrSet

function emitError(err) {
    setTimeout(function() {
        throw err
    }, 0)
}


function main(global,
    moduleDefs, cachedModules, moduleMeta,
    ignoreUnaccepted, bundleKey,
    socketio,
    bundle__filename, bundle__dirname
) {
    var forEach = require('lodash/forEach')
    var some = require('lodash/some')
    var map = require('lodash/map')
    var filter = require('lodash/filter')
    var forOwn = require('lodash/forOwn')
    var mapValues = require('lodash/mapValues')
    var assign = require('lodash/assign')  
      
    function makeModuleIndexesToNames(moduleMeta) {
        var moduleIndexesToNames = {}
        forOwn(moduleMeta, function(value, name) {
            moduleIndexesToNames[value.index] = name
        })
        return moduleIndexesToNames
    }

      
    var moduleIndexesToNames = makeModuleIndexesToNames(moduleMeta)

    const socket = {
      
        emit: function(event, data) {
            socketio.sendSocketMessage({
                CoreHmr: event,
                data:    data
            })
        },

        on(event, cb) {
            if(!socket.callbacks[event])
                socket.callbacks[event] = []
          
            socket.callbacks[event].push(cb)
        },
      
        callbacks: {}
    }
      
    socketio.socketHooks.push(function(msg) {
        if(msg.CoreHmr) {
            if(socket.callbacks[msg.CoreHmr]) {
                const callbacks = socket.callbacks[msg.CoreHmr]
                for(var key in callbacks) {
                    try {
                        callbacks[key](msg.data)
                    } catch(e) {
                        console.error(e)
                    }
                }
            }
        }
    })
      

    var name, i, len

    if (global._hmr[bundleKey].setStatus) { // We're in a reload!
        global._hmr[bundleKey].newLoad = {
            moduleDefs:           moduleDefs,
            moduleMeta:           moduleMeta,
            moduleIndexesToNames: moduleIndexesToNames
        }
        return false
    }
      
    var runtimeModuleInfo = {}
    var createInfoEntry = function(name) {
        runtimeModuleInfo[name] = {
            index:           moduleMeta[name].index,
            hash:            moduleMeta[name].hash,
            parents:         new StrSet(moduleMeta[name].parents),
            module:          null,
            disposeData:     null,
            accepters:       new StrSet(),
            accepting:       new StrSet(),
            decliners:       new StrSet(),
            declining:       new StrSet(),
            selfAcceptCbs:   [], // may contain null. nonzero length means module is self-accepting
            disposeHandlers: []
        }
    }
    for (name in moduleMeta) {
        if (has(moduleMeta, name)) {
            createInfoEntry(name)
        }
    }

  

    var lastScriptData = null

    var getOutdatedModules = function() {
        var outdated = []
        var name
        // add changed and deleted modules
        for (name in runtimeModuleInfo) {
            if (has(runtimeModuleInfo, name)) {
                if (
                    !has(localHmr.newLoad.moduleMeta, name) ||
            runtimeModuleInfo[name].hash !== localHmr.newLoad.moduleMeta[name].hash
                ) {
                    outdated.push(name)
                }
            }
        }
        // add brand new modules
        for (name in localHmr.newLoad.moduleMeta) {
            if (has(localHmr.newLoad.moduleMeta, name)) {
                if (!has(runtimeModuleInfo, name)) {
                    outdated.push(name)
                }
            }
        }
        // add modules that are non-accepting/declining parents of outdated modules.
        // important: if outdated has new elements added during the loop,
        // then we iterate over them too.
        for (var i=0; i<outdated.length; i++) {
            name = outdated[i]
            // jshint -W083
            if (has(runtimeModuleInfo, name)) {
                runtimeModuleInfo[name].parents.forEach(function(parentName) {
                    if (
                        runtimeModuleInfo[name].selfAcceptCbs.length === 0 &&
              !runtimeModuleInfo[name].accepters.has(parentName) &&
              !runtimeModuleInfo[name].decliners.has(parentName) &&
              outdated.indexOf(parentName) === -1
                    ) {
                        outdated.push(parentName)
                    }
                })
            }
        }
        return outdated
    }

    var moduleHotApply = function(options, cb) {
        if (typeof options === 'function') {
            cb = options
            options = null
        }

        if (!cb) {
            throw new Error("module.hot.apply callback parameter required")
        }

        var ignoreUnaccepted = !!(options && options.ignoreUnaccepted)
        if (localHmr.status !== 'ready') {
            cb(new Error("module.hot.apply can only be called while status is ready"))
            return
        }

        var outdatedModules = getOutdatedModules()
        var isValueNotInOutdatedModules = function(value) {
            return outdatedModules.indexOf(value) === -1
        }
        var i, len
        var acceptedUpdates = filter(outdatedModules, function(name) {
            if (has(runtimeModuleInfo, name)) {
                if (
                    runtimeModuleInfo[name].decliners.some(isValueNotInOutdatedModules) ||
            (
                runtimeModuleInfo[name].accepters.size() === 0 &&
              runtimeModuleInfo[name].selfAcceptCbs.length === 0 &&
              runtimeModuleInfo[name].parents.some(isValueNotInOutdatedModules)
            )
                ) {
                    return false
                }
            }

            return true
        })
        if (!ignoreUnaccepted && outdatedModules.length !== acceptedUpdates.length) {
            localHmr.setStatus('idle')
            cb(new Error("Some updates were declined"))
            return
        }

        var an
        for (i=0, len=acceptedUpdates.length; i<len; i++) {
            an = acceptedUpdates[i]
            if (has(runtimeModuleInfo, an)) {
                runtimeModuleInfo[an].disposeData = {}
                for (var j=0; j<runtimeModuleInfo[an].disposeHandlers.length; j++) {
                    try {
                        runtimeModuleInfo[an].disposeHandlers[j].call(null, runtimeModuleInfo[an].disposeData)
                    } catch(e) {
                        localHmr.setStatus('idle')
                        cb(e || new Error("Unknown dispose callback error"))
                        return
                    }
                }
            }
        }
        var selfAccepters = []
        for (i=0, len=acceptedUpdates.length; i<len; i++) {
            an = acceptedUpdates[i]
            // jshint -W083
            if (!has(runtimeModuleInfo, an)) {
                // new modules
                runtimeModuleInfo[an] = {
                    index:           an,
                    hash:            localHmr.newLoad.moduleMeta[an].hash,
                    parents:         new StrSet(localHmr.newLoad.moduleMeta[an].parents),
                    module:          null,
                    disposeData:     null,
                    accepters:       new StrSet(),
                    accepting:       new StrSet(),
                    decliners:       new StrSet(),
                    declining:       new StrSet(),
                    selfAcceptCbs:   [],
                    disposeHandlers: []
                }
            } else if (!has(localHmr.newLoad.moduleMeta, an)) {
                // removed modules
                delete cachedModules[runtimeModuleInfo[an].index]
                delete runtimeModuleInfo[an]
                continue
            } else {
                // updated modules
                runtimeModuleInfo[an].hash = localHmr.newLoad.moduleMeta[an].hash
                runtimeModuleInfo[an].parents = new StrSet(localHmr.newLoad.moduleMeta[an].parents)
                runtimeModuleInfo[an].module = null
                runtimeModuleInfo[an].accepting.forEach(function(accepted) {
                    runtimeModuleInfo[accepted].accepters.del(an)
                })
                runtimeModuleInfo[an].accepting = new StrSet()
                runtimeModuleInfo[an].declining.forEach(function(accepted) {
                    runtimeModuleInfo[accepted].decliners.del(an)
                })
                runtimeModuleInfo[an].declining = new StrSet()
                forEach(runtimeModuleInfo[an].selfAcceptCbs, function(cb) {
                    selfAccepters.push({ name: an, cb: cb })
                })
                runtimeModuleInfo[an].selfAcceptCbs = []
                runtimeModuleInfo[an].disposeHandlers = []
            }

            moduleDefs[runtimeModuleInfo[an].index] = [
                // module function
                localHmr.newLoad.moduleDefs[localHmr.newLoad.moduleMeta[an].index][0],
                // module deps
                mapValues(localHmr.newLoad.moduleDefs[localHmr.newLoad.moduleMeta[an].index][1], function(depIndex, depRef) {
                    var depName = localHmr.newLoad.moduleIndexesToNames[depIndex]
                    if (has(localHmr.runtimeModuleInfo, depName)) {
                        return localHmr.runtimeModuleInfo[depName].index
                    } else {
                        return depName
                    }
                })
            ]
            cachedModules[runtimeModuleInfo[an].index] = null
        }

        // Update the accept handlers list and call the right ones
        var errCanWait = null
        var updatedNames = new StrSet(acceptedUpdates)
        var oldUpdateHandlers = localHmr.updateHandlers
        var relevantUpdateHandlers = []
        var newUpdateHandlers = []
        for (i=0, len=oldUpdateHandlers.length; i<len; i++) {
            if (!updatedNames.has(oldUpdateHandlers[i].accepter)) {
                newUpdateHandlers.push(oldUpdateHandlers[i])
            }

            if (updatedNames.hasIntersection(oldUpdateHandlers[i].deps)) {
                relevantUpdateHandlers.push(oldUpdateHandlers[i])
            }
        }
        localHmr.updateHandlers = newUpdateHandlers
        for (i=0, len=relevantUpdateHandlers.length; i<len; i++) {
            try {
                relevantUpdateHandlers[i].cb.call(null, acceptedUpdates)
            } catch(e) {
                if (errCanWait) 
                    emitError(errCanWait)

                errCanWait = e
            }
        }

        // Call the self-accepting modules
        forEach(selfAccepters, function(obj) {
            try {
                require(runtimeModuleInfo[obj.name].index)
            } catch(e) {
                if (obj.cb) {
                    obj.cb.call(null, e)
                } else {
                    if (errCanWait) 
                        emitError(errCanWait)

                    errCanWait = e
                }
            }
        })

        localHmr.setStatus('idle')
        cb(errCanWait, acceptedUpdates)
    }

    var setupSocket = function() {

        var isAcceptingMessages = false
        var isUpdating = false
        var queuedUpdateMessages = []
        socket.on('sync confirm', function() {
            console.log('[HMR] Websocket connection successful.')
            isAcceptingMessages = true
            queuedUpdateMessages = []
        })

        var acceptNewModules = function(msg) {
        // Make sure we don't accept new modules before we've synced ourselves.
            if (!isAcceptingMessages) 
                return

            if (isUpdating) {
                queuedUpdateMessages.push(msg)
                return
            }

            // Take the message and create a localHmr.newLoad value as if the
            // bundle had been re-executed, then call moduleHotApply.
            isUpdating = true

            // random id so we can make the normally unnamed args have random names
            var rid = String(Math.random()).replace(/[^0-9]/g, '')

            var newModuleDefs = localHmr.newLoad ? localHmr.newLoad.moduleDefs : assign({}, moduleDefs)
            var newModuleMeta = localHmr.newLoad ?
                localHmr.newLoad.moduleMeta : mapValues(runtimeModuleInfo, function(value, key) {
                    return {
                        index:   value.index,
                        hash:    value.hash,
                        parents: value.parents.toArray()
                    }
                })
            forOwn(msg.newModuleData, function(value, key) {
                newModuleMeta[key] = {
                    index:   value.index,
                    hash:    value.hash,
                    parents: value.parents
                }
            })
            forEach(msg.removedModules, function(removedName) {
                delete newModuleDefs[runtimeModuleInfo[removedName].index]
                delete newModuleMeta[removedName]
            })
            var newModuleIndexesToNames = makeModuleIndexesToNames(newModuleMeta)
            forOwn(msg.newModuleData, function(value, key) {
                // this part needs to run after newModuleMeta and
                // newModuleIndexesToNames are populated.
                var newModuleFunction = (function() {
                    var fn
                    // jshint evil:true
                    if (bundle__filename || bundle__dirname) {
                        fn = new Function('require', 'module', 'exports', '_u1'+rid, '_u2'+rid, '__u3'+rid, '__u4'+rid, '__filename', '__dirname', value.source)
                        return function(require, module, exports, _u1, _u2, _u3, _u4) {
                            global._hmr[bundleKey].initModule(key, module)
                            fn.call(this, require, module, exports, _u1, _u2, _u3, _u4, bundle__filename, bundle__dirname)
                        }
                    } else {
                        fn = new Function('require', 'module', 'exports', '_u1'+rid, '_u2'+rid, '__u3'+rid, '__u4'+rid, value.source)
                        return function(require, module, exports, _u1, _u2, _u3, _u4) {
                            global._hmr[bundleKey].initModule(key, module)
                            fn.call(this, require, module, exports, _u1, _u2, _u3, _u4)
                        }
                    }
                })()

                newModuleDefs[newModuleMeta[key].index] = [
                    // module function
                    newModuleFunction,
                    // module deps
                    mapValues(value.deps, function(depIndex, depRef) {
                        var depName = newModuleIndexesToNames[depIndex]
                        if (has(newModuleMeta, depName)) {
                            return newModuleMeta[depName].index
                        } else {
                            return depName
                        }
                    })
                ]
            })
            localHmr.newLoad = {
                moduleDefs:           newModuleDefs,
                moduleMeta:           newModuleMeta,
                moduleIndexesToNames: newModuleIndexesToNames
            }
            localHmr.setStatus('ready')
            var outdatedModules = getOutdatedModules()
            moduleHotApply({ ignoreUnaccepted: ignoreUnaccepted }, function(err, updatedNames) {
                if (err) {
                    console.error('[HMR] Error applying update', err)
                }

                if (updatedNames) {
                    console.log('[HMR] Updated modules', updatedNames)
              
                    for(var key in updatedNames) {
                        if(updatedNames[key].indexOf('browserify-client.js') !== -1) {
                            // Force refresh on entrypoint changed (to avoid vue-hot-reload error)
                            location.reload()
                        }
                    }

                    if (outdatedModules.length !== updatedNames.length) {
                        var notUpdatedNames = filter(outdatedModules, function(name) {
                            return updatedNames.indexOf(name) === -1
                        })
                        console.log('[HMR] Some modules were not updated', notUpdatedNames)
                    }
                }

                isUpdating = false
                var queuedMsg
                while ((queuedMsg = queuedUpdateMessages.shift())) {
                    acceptNewModules(queuedMsg)
                }
            })
        }
        socket.on('new modules', acceptNewModules)
        
        //-------------------
        
        isAcceptingMessages = false
        var syncMsg = mapValues(runtimeModuleInfo, function(value, name) {
            return {
                hash: value.hash
            }
        })
        socket.emit('sync', syncMsg)
        
        return socket
    }

    var localHmr = {
        runtimeModuleInfo: runtimeModuleInfo,

        status:    "idle",
        setStatus: function(status) {
            this.status = status
            var statusHandlers = this.statusHandlers.slice()
            for (var i=0, len=statusHandlers.length; i<len; i++) {
                statusHandlers[i].call(null, status)
            }
        },
        statusHandlers: [],
        updateHandlers: [],

        // during a reload this is set to an object with moduleDefs,
        // moduleMeta, and moduleIndexesToNames properties
        newLoad: null,

        initModule: function(name, module) {
            runtimeModuleInfo[name].module = module
            module.hot = {
                accept: function(deps, cb) {
                    if (!cb && (!deps || typeof deps === 'function')) { // self
                        cb = deps
                        deps = null
                        runtimeModuleInfo[name].selfAcceptCbs.push(cb)
                    } else {
                        if (typeof deps === 'string') {
                            deps = [deps]
                        }

                        var depNames = new StrSet()
                        for (var i=0, depsLen=deps.length; i<depsLen; i++) {
                            var depIndex = moduleDefs[runtimeModuleInfo[name].index][1][deps[i]]
                            if (depIndex === undefined || !has(moduleIndexesToNames, depIndex)) {
                                throw new Error("File does not use dependency: "+deps[i])
                            }

                            depNames.add(moduleIndexesToNames[depIndex])
                        }
                        deps = null
                        depNames.forEach(function(depName) {
                            runtimeModuleInfo[depName].accepters.add(name)
                            runtimeModuleInfo[name].accepting.add(depName)
                        })
                        if (cb) {
                            localHmr.updateHandlers.push({
                                accepter: name,
                                deps:     depNames,
                                cb:       cb
                            })
                        }
                    }
                },
                decline: function(deps) {
                    if (!deps) { // self
                        runtimeModuleInfo[name].decliners.add(name)
                        runtimeModuleInfo[name].declining.add(name)
                    } else {
                        if (typeof deps === 'string') {
                            deps = [deps]
                        }

                        for (var i=0, depsLen=deps.length; i<depsLen; i++) {
                            var depIndex = moduleDefs[runtimeModuleInfo[name].index][1][deps[i]]
                            if (depIndex === undefined || !has(moduleIndexesToNames, depIndex)) {
                                throw new Error("File does not use dependency: "+deps[i])
                            }

                            var depName = moduleIndexesToNames[depIndex]
                            runtimeModuleInfo[depName].decliners.add(name)
                            runtimeModuleInfo[name].declining.add(depName)
                        }
                    }
                },
                data:    runtimeModuleInfo[name].disposeData,
                dispose: function(cb) {
                    return this.addDisposeHandler(cb)
                },
                addDisposeHandler: function(cb) {
                    runtimeModuleInfo[name].disposeHandlers.push(cb)
                },
                removeDisposeHandler: function(cb) {
                    var ix = runtimeModuleInfo[name].disposeHandlers.indexOf(cb)
                    if (ix !== -1) {
                        runtimeModuleInfo[name].disposeHandlers.splice(ix, 1)
                    }
                },

                // Management
                apply:  moduleHotApply,
                status: function(cb) {
                    if (cb) {
                        return this.addStatusHandler(cb)
                    }

                    return localHmr.status
                },
                addStatusHandler: function(cb) {
                    localHmr.statusHandlers.push(cb)
                },
                removeStatusHandler: function(cb) {
                    var ix = localHmr.statusHandlers.indexOf(cb)
                    if (ix !== -1) {
                        localHmr.statusHandlers.splice(ix, 1)
                    }
                }
            }
        }
    }
    global._hmr[bundleKey] = localHmr

    setupSocket()
    return true
}

//----------------------------------------------------------------------------------------

(function(global, _main, moduleDefs, cachedModules, _entries) {

    var moduleMeta = null/* !^^moduleMeta*/
    var originalEntries = null/* !^^originalEntries*/
    var ignoreUnaccepted = null/* !^^ignoreUnaccepted*/
    var bundleKey = null/* !^^bundleKey*/
    var sioPath = null/* !^^sioPath*/
    var incPath = null/* !^^incPath*/

    if (!global._hmr) {
        try {
            Object.defineProperty(global, '_hmr', { value: {} })
        } catch(e) {
            global._hmr = {}
        }
    }

    if (!Object.prototype.hasOwnProperty.call(global._hmr, bundleKey)) {
    // Temporary hack so requiring modules works before the _hmr values are
    // correctly initialized.
        global._hmr[bundleKey] = { initModule: function() {} }
    }
    

    global.console = global.console ? global.console : {
        error: function() {}, log: function() {}
    }


    // var main       = require(incPath);
    const socketio = require(sioPath)
    
    var isFirstRun = main(global,
        moduleDefs, cachedModules, moduleMeta,
        ignoreUnaccepted, bundleKey,
        socketio.default ? socketio.default : socketio,
        typeof __filename !== 'undefined' && __filename,
        typeof __dirname !== 'undefined' && __dirname
    )
    if (isFirstRun) {
        for (var i=0, len=originalEntries.length; i<len; i++) {
            require(originalEntries[i])
        }
    }
}).call(
    this,
    typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {},
    arguments[3], arguments[4], arguments[5], arguments[6]
)