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
    }
    
    on(cb) {
        if(this.triggerData !== null)
            cb(this.triggerData);
        
        this.callbacks.push(cb);
    }

    once(cb) {
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
        
        if(this.triggerData !== null)
            return cb(this.triggerData);

        function cc() {
            try {
                cb();
                this.remove(cc);
            } catch(e) {
                this.remove(cc);
                throw(e);
            }
        }

        this.callbacks.push(cc.bind(this));
    }

    remove(cb) {
        var index = this.callbacks.indexOf(cb);
        
        if(index !== -1)
            this.callbacks.splice(index, 1);
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