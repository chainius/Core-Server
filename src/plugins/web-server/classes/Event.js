const nativeConsole = console;

class Event {
    
    constructor({ retainTrigger, console }) {
        this.callbacks      = [];
        this.retainTrigger  = retainTrigger;
        this.triggerData    = null;
        this.console        = console || nativeConsole;
    }

    execCallback(cb, data, err) {
        try {
            cb(data, err)
        } catch(e) {
            this.console.error(e);
        }
        
        return this;
    }
    
    on(cb) {
        if(this.triggerData !== null)
            this.execCallback(cb, this.triggerData);
        
        this.callbacks.push(cb);
        return this;
    }

    once(cb, errCb) {
        if(!cb) {
            return new Promise((resolve, reject) => {
                this.once(function(res, err) {
                    if(err)
                        reject(err);
                    else
                        resolve(res);
                });
            });
        }
        
        if(this.triggerData !== null) {
            return this.execCallback(cb, this.triggerData);
        }

        function cc(data, err) {
            try {
                if(err && errCb)
                    errCb(err);
                else
                    cb(data, err);

                this.remove(cc);
            } catch(e) {
                this.remove(cc);
                throw(e);
            }
        }

        this.callbacks.push(cc.bind(this));
        return this;
    }

    remove(cb) {
        var index = this.callbacks.indexOf(cb);
        
        if(index !== -1)
            this.callbacks.splice(index, 1);
    }

    then(cb, errCb) {
        return this.once(cb);
    }

    catch(cb) {
        return this.once((res, err) => {
            if(err)
                cb(err);
        });
    }
    
    trigger(data, err) {
        if(this.retainTrigger)
            this.triggerData   = data;

        this.callbacks.forEach((cb) => {
            this.execCallback(cb, data, err);
        });
    }
}

module.exports = Event;