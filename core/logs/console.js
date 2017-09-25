const chalk      = require('chalk');
const dateFormat = require('dateformat');

process.on('unhandledRejection', function(reason, p)
{
    log('error', 'PROMISE', 'Possibly Unhandled Rejection at: Promise ', p, ' reason: ', reason);
});

process.on('uncaughtException', (err) =>
{
    //ToDo request process restart
    log('error', 'PROCESS', 'uncaughtException exception detected', err);
});

/**
 * @name getTime
 * @description Gets the current time and formats it.
 */
function getTime()
{
    const now = new Date();
    return dateFormat(now, 'yyyy-mm-dd hh:MM:ss');
}


function log(type, tag, ...messages)
{
    var premsg = chalk.blue(type + ':');

    switch (type)
    {
        case 'success':
            premsg = chalk.green('Success:');
            break;
        case 'error':
            premsg = chalk.red('Error:');
            break;
        case 'warn':
            premsg = chalk.yellow('Warning:');
            break;
        case 'info':
            premsg = chalk.blue('Info:');
            break;
        case 'debug':
            premsg = chalk.magenta('Debug:');
            break;
    }

    console.log.call(console, premsg, chalk.gray(getTime()), chalk.bold('[' + tag + ']'), ...messages);
};

const Console = module.exports = {

    log(tag, ...messages) {
        return log.call(this, 'debug', tag, ...messages);
    },

    error(tag, ...messages) {
        return log.call(this, 'error', tag, ...messages);
    },

    warn(tag, ...messages) {
        return log.call(this, 'warn', tag, ...messages);
    },

    info(tag, ...messages) {
        return log.call(this, 'info', tag, ...messages);
    },

    debug(tag, ...messages) {
        return log.call(this, 'debug', tag, ...messages);
    },

    success(tag, ...messages) {
        return log.call(this, 'success', tag, ...messages);
    },

    implement(obj, tag) {
        const subConsole = {
            log(...messages) {
                return log.call(this, 'debug', tag, ...messages);
            },

            error(...messages) {
                return log.call(this, 'error', tag, ...messages);
            },

            warn(...messages) {
                return log.call(this, 'warn', tag, ...messages);
            },

            info(...messages) {
                return log.call(this, 'info', tag, ...messages);
            },

            debug(...messages) {
                return log.call(this, 'debug', tag, ...messages);
            },

            success(...messages) {
                return log.call(this, 'success', tag, ...messages);
            },

            dir: function(...messages)
            {
                return log.call(this, 'debug', tag, ...messages);
            },

            clear: function() {
                return process.stdout.write('\033c');
            },

            create(tag) {
                const cons = {};
                module.exports.implement(cons, tag);
                return cons.console;
            }
        };

        if(obj.prototype)
            obj.prototype.console = subConsole;

        obj.console = subConsole;
    },

    create(tag) {
        const cons = {};
        module.exports.implement(cons, tag);
        return cons.console;
    }

};

console.create = Console.create;
console.implement = Console.implement;