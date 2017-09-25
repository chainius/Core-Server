'use strict';

/** SiteManager */
class SiteManager extends SuperClass
{
    constructor(HttpServer)
    {
        super(HttpServer);

        //this.argentDiscovery  = new argentDisc(config.networkDiscovery);

        /*this.taskExecutors      = {};
        this.taskWaiters        = {};*/
        //this.onWorker('discovery-task', this.parseTask);
        //this.onWorker('task-response', this.parseTaskResponse);
    }

    /**
    * On worker cmd received call methods
    * @param cmd {String}
    * @param method {Function}
    */
    /*onWorker(cmd, func)
    {
        var that = this;
        process.on('message', function(command, data)
        {
            if(command.type === 'discovery-task' && cmd === 'discovery-task')
                func.call(that, command, data);
            else if(command.type === 'task-response' && cmd === command.type)
                func.call(that, command, data);
            if (command === cmd)
                func.call(that, data);
        });
    }*/

    /*parseTaskResponse(res) {
        if(this.taskWaiters[res.id])
            this.taskWaiters[res.id](res.data, res.isError);
    }

    parseTask(task) {
        var result;

        if(!this.taskExecutors[task.name])
        {
            result = new Promise(function(resolve, reject) {
                reject('This worker has no methods to execute the required task');
            });
        }
        else {
            result = this.taskExecutors[task.name].call(this, task.task);
        }

        if(!result) {
            result = new Promise(function(resolve) {
                resolve();
            });
        }
        else if(!result.then) {
            const oldResult = result;
            result = new Promise(function(resolve) {
                resolve(oldResult);
            });
        }

        result.then(function(data) {
            process.send({
                type: 'task-response',
                id: task.id,
                isError: false,
                data: data
            });
        })
        .catch(function(err) {
            process.send({
                type: 'task-response',
                id: task.id,
                isError: true,
                data: err
            });
        })
    }*/

    /**
    * Execute function on task received from the network
    * @param task {String}
    * @param cb {Function}
    */
    /*onTask(task, cb) {
        this.taskExecutors[task] = cb;
    }*/

    /**
    * Execute an api on task received from the network
    * @param task {String}
    * @param api {String}
    */
    /*bindTaskApi(task, api) {
        this.taskExecutors[task] = function(taskData) {
            const session = this.sessionsManager.getFromToken('__global__');
            return session.api(api, taskData, '*', {}, {});
        }
    }*/

    /**
    * Send a task over the network
    * @param name {String}
    * @param task {Object}
    */
    /*sendTask(name, task) {
        const id = 'siteManager' + Crypter.sha1Hex(name + JSON.stringify(task) + Math.random());

        const _this = this;
        return new Promise(function(resolve, reject) {

            _this.taskWaiters[id] = function(data, isErr) {
                delete _this.taskWaiters[id];

                if(isErr)
                    reject(data);
                else
                    resolve(data);
            };

            process.send({
                type: 'task',
                id: id,
                name: name,
                task: task
            });

        });
    }*/

    /**
    * Distrubte a job into the network
    */
    /*distributeNetworkJob() {
        //...
    }*/
}

module.exports = SiteManager;