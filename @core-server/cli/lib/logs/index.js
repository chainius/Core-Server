const chalk = require('chalk')
const dateFormat = require('dateformat')

process.on('unhandledRejection', function(reason, p) {
    log('error', 'PROMISE', 'Possibly Unhandled Rejection with reason: ', reason)
})

process.on('uncaughtException', (err) => {
    // ToDo request process restart
    log('error', 'PROCESS', 'uncaughtException exception detected', err)
})

/**
 * @name getTime
 * @description Gets the current time and formats it.
 */
function getTime() {
    const now = new Date()
    return dateFormat(now, 'yyyy-mm-dd HH:MM:ss')
}

function log(type, tag, ...messages) {
    execHook(type, tag, ...messages)
    var premsg = chalk.blue(type + ':')

    switch (type) {
    case 'success':
        premsg = chalk.green('Success:')
        break
    case 'error':
        premsg = chalk.red('Error:')
        break
    case 'warn':
        premsg = chalk.yellow('Warning:')
        break
    case 'info':
        premsg = chalk.blue('Info:')
        break
    case 'debug':
        premsg = chalk.magenta('Debug:')
        break
    }

    console.log.call(console, premsg, chalk.gray(getTime()), chalk.bold('[' + tag + ']'), ...messages)
}

var hooks = {}

function execHook(type, tag, ...messages) {
    try {
        if(!hooks[type])
            return

        for(var hook of hooks[type]) {
            try {
                hook(tag, ...messages)
            } catch(e) {
                console.error('Console hook error', type, tag, e)
            }
        }
    } catch(e) {
        console.error(e)
    }
}

const Console = module.exports = {

    log(tag, ...messages) {
        return log.call(this, 'debug', tag, ...messages)
    },

    error(tag, ...messages) {
        return log.call(this, 'error', tag, ...messages)
    },

    warn(tag, ...messages) {
        return log.call(this, 'warn', tag, ...messages)
    },

    info(tag, ...messages) {
        return log.call(this, 'info', tag, ...messages)
    },

    debug(tag, ...messages) {
        return log.call(this, 'debug', tag, ...messages)
    },

    success(tag, ...messages) {
        return log.call(this, 'success', tag, ...messages)
    },
    
    time(name) {
        console.time(name)
    },
    
    timeEnd(name) {
        console.timeEnd(name)
    },

    implement(obj, tag) {
        const subConsole = {
            log(...messages) {
                return log.call(this, 'debug', tag, ...messages)
            },

            error(...messages) {
                return log.call(this, 'error', tag, ...messages)
            },

            warn(...messages) {
                return log.call(this, 'warn', tag, ...messages)
            },

            info(...messages) {
                return log.call(this, 'info', tag, ...messages)
            },

            debug(...messages) {
                return log.call(this, 'debug', tag, ...messages)
            },

            success(...messages) {
                return log.call(this, 'success', tag, ...messages)
            },

            dir: function(...messages) {
                return log.call(this, 'debug', tag, ...messages)
            },

            clear: function() {
                return process.stdout.write('\033c')
            },

            create(tag) {
                const cons = {}
                module.exports.implement(cons, tag)
                return cons.console
            },

            time(name) {
                console.time(name)
            },

            timeEnd(name) {
                console.timeEnd(name)
            },

            addHook(type, cb) {
                hooks[type] = hooks[type] || []
                hooks[type].push(cb)
            }
        }

        if(obj.prototype)
            obj.prototype.console = subConsole

        obj.console = subConsole
    },

    create(tag) {
        const cons = {}
        module.exports.implement(cons, tag)
        return cons.console
    },

    _log: log
}

console.create = Console.create
console.implement = Console.implement