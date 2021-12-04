const nativeConsole = console

class Event {
    
    constructor(config) {
        const { retainTrigger, console } = config || {}

        this.callbacks = []
        this.retainTrigger = retainTrigger
        this.triggerData = null
        this.console = console || nativeConsole
    }

    execCallback(cb, data, err) {
        try {
            cb(data, err)
        } catch(e) {
            this.console.error(e)
        }
        
        return this
    }
    
    on(cb) {
        if(this.triggerData !== null)
            this.execCallback(cb, this.triggerData)
        
        this.callbacks.push(cb)
        return this
    }

    once(cb, errCb) {
        if(!cb) {
            return new Promise((resolve, reject) => {
                this.once(function(res, err) {
                    if(err)
                        reject(err)
                    else
                        resolve(res)
                })
            })
        }

        if(this.triggerData !== null)
            return this.execCallback(cb, this.triggerData)

        var cc = (function ccx(data, err) {
            try {
                if(err && errCb)
                    errCb(err)
                else
                    cb(data, err)

                this.remove(cc)
            } catch(e) {
                this.remove(cc)
                throw(e)
            }
        }).bind(this)

        this.callbacks.push(cc)
        return this
    }

    remove(cb) {
        var index = this.callbacks.indexOf(cb)

        if(index !== -1)
            this.callbacks.splice(index, 1)
    }

    then(cb, errCb) {
        return this.once(cb, errCb)
    }

    catch(cb) {
        return this.once((res, err) => {
            if(err)
                cb(err)
        })
    }

    trigger(data, err) {
        if(this.retainTrigger)
            this.triggerData = data

        const cbCopy = []

        this.callbacks.forEach((cb) => cbCopy.push(cb))
        
        cbCopy.forEach((cb) => {
            this.execCallback(cb, data, err)
        })
    }

    valueOf() {
        if(!this.retainTrigger)
            return null

        return this.triggerData
    }
    
    toString() {
        return String(this.valueOf())
    }
}

module.exports = Event