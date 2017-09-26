'use strict';

const _      = require('lodash');
const has    = require('./has.js');

function log() {
  console.log.apply(console, [new Date().toTimeString(), '[HMR]'].concat(_.toArray(arguments)));
}

class SocketServer
{
    constructor()
    {
        this.uncommittedNewModuleData = {},
        this.currentModuleData        = {};

        this.sockets = [];
        this.on('connection', this.onConnetion);

        const _this = this;
        process.on('message', function(msg)
        {
            if(msg.SocketServer && msg.method && msg.data)
            {
                if(typeof(_this[msg.method]) === 'function')
                {
                    _this[msg.method].apply(_this, Object.keys(msg.data).map(function (key) { return msg.data[key]; }));
                }
            }
        });
    }

    on(event, cb)
    {
        const server = plugins.getEntry('web-server/MasterServer');

        if(!server)
            return;

        const _this = this;
        process.nextTick(function() {
            server.echo.on(event, function()
            {
                cb.apply(_this, arguments);
            });
        });
    }

    onConnetion(socket)
    {
        this.sockets.push(socket);
        const _this = this;

        socket.on('close', function() {
            try
            {
                const index = _this.sockets.indexOf(socket);

                if(index !== -1)
                    _this.sockets.splice(index, 1);
            }
            catch(e)
            {
                console.error(e);
            }
        });

        socket.on('data', function(message) {
            try
            {
                message = JSON.parse(message);
                if(message.CoreHmr === 'sync' && message.data)
                {
                    _this.onSync(socket, message.data);
                }
            }
            catch(e) {}
        });
    }

    onSync(socket, syncMsg)
    {
        console.log('User connected, syncing');
        var newModuleData = _.chain(this.currentModuleData)
            .toPairs()
            .filter(function(pair) {
                return !has(syncMsg, pair[0]) || syncMsg[pair[0]].hash !== pair[1].hash;
            })
            .fromPairs()
            .value();

        const _this = this;
        var removedModules = _.chain(syncMsg)
            .keys()
            .filter(function(name) {
                return !has(_this.currentModuleData, name);
            })
            .value();

        this.emitToSocket(socket, 'sync confirm', null);
        if (Object.keys(newModuleData).length || removedModules.length)
        {
            this.emitToSocket(socket, 'new modules', {newModuleData: newModuleData, removedModules: removedModules});
        }
    }

    emitToSocket(socket, event, data)
    {
        try
        {
            socket.write(JSON.stringify({
                CoreHmr: event,
                data: data
            }));
        }
        catch(e)
        {
            console.error(e);
        }
    }

    emit(event, data)
    {
        for(var key in this.sockets)
        {
            try
            {
                this.emitToSocket(this.sockets[key], event, data);
            }
            catch(e)
            {
                console.error(e);
            }
        }
    }

    //-------------------------------------

    //Transport between browserify worker and server worker
    transportMessage(event, args)
    {
        //if(global.sl_server)
        //    return false;

        const worker = require('cluster').worker;

        if(!worker)
            return;


        process.send({
            SocketServer: worker.id,
            method: event,
            data: args
        });

        return true;
    }

    newModule(name, data)
    {
        if(this.transportMessage('newModule', arguments))
            return;

        this.uncommittedNewModuleData[name] = data;
    }

    removedModules(modules)
    {
        if(this.transportMessage('removedModules', arguments))
            return;

        _.assign(this.currentModuleData, this.uncommittedNewModuleData);

        const _this = this;
        modules.forEach(function(name) {
            delete _this.currentModuleData[name];
        });

        if (Object.keys(this.uncommittedNewModuleData).length || modules.length) {
            console.log('Emitting updates');
            this.emit('new modules', {
                newModuleData: this.uncommittedNewModuleData,
                removedModules: modules
            });
        }

        this.uncommittedNewModuleData = {};

        return {
            type: 'confirmNewModuleData'
        }
    }
}

module.exports = SocketServer;