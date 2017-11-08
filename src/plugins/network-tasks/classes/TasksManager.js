class TasksManager {

    constructor(discovery) {
        this.discovery      = discovery;
        this.reponseWaiters = {};
        this.workerIncrement = 0;

        //-----------------------------------------------------

        discovery.on('task', function(task, worker) {
            var handler;

            if(worker.worker)
                handler = this.distribute(task.name, task.params);
            else
                handler = this.onTask(task);

            handler.then(function(result) {
                worker.send('task-response', {
                    id: task.id,
                    result: result
                });
            }).catch(function(error) {
                /*if(error.message)
                    error = error.message;
                else if(error.error)
                    error = error.error;*/
                
                if(error.message) {
                    error = {
                        error: error.message,
                        stack: error.stack
                    }
                }

                worker.send('task-response', {
                    id: task.id,
                    error: error
                });
            });
        }.bind(this));

        //-----------------------------------------------------

        discovery.on('task-response', function(argv) {
            this.onTaskResponse(argv);
        }.bind(this));
    }

    distribute(name, params) {
        const discovery = this.discovery;
        const _this     = this;

        return new Promise(function(resolve, reject) {
            const socket = discovery.getNextSocket();

            if(socket === null)
                return reject('No worker found, the required task could not be executed');

            const id  = name + '_' + Math.random() + 'work' + Math.random();

            //--------------

            function onDisconnect() {
                if(_this.reponseWaiters[id])
                    delete _this.reponseWaiters[id];

                reject('The task could not be completed because the worker disconnected');
            }

            socket.onDisconnected(onDisconnect);

            //--------------

            _this.reponseWaiters[id] = function(result) {
                try {
                    socket.removeListener(onDisconnect);

                    if(result.error)
                        reject(result.error);
                    else
                        resolve(result.result);
                }
                catch(e) {
                    reject(e);
                }
            };

            socket.send('task', {
                id:     id,
                name:   name,
                params: params
            });
        });
    }

    onTask(task) {
        const workers        = this.discovery.getInternalWorkers();
        const index          = this.workerIncrement >= workers.length ? 0 : this.workerIncrement;
        this.workerIncrement = index + 1;

        const worker = workers[index];

        const _this = this;
        return new Promise(function(resolve, reject) {

            if(!worker)
                return reject('No worker found that could execute this task');

            if(!task.id)
                return reject('Received a task without id');

            function listener() {
                reject('The worker has been disconnected');
            }

            worker.onDisconnected(listener);

            _this.reponseWaiters[task.id] = function(result) {
                try {
                    worker.removeListener(listener);
                    resolve(result);
                }
                catch(e) {
                    reject(e);
                }
            };

            worker.send('task', task);
        });
    }

    onTaskResponse(argv) {
        if(this.reponseWaiters[argv.id])
            this.reponseWaiters[argv.id](argv);
    }
}

module.exports = TasksManager;