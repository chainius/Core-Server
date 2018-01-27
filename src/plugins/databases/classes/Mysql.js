const mysql = require('mysql2/promise');

function queryFormat(sql, values, timeZone)
{
    if (values === null || values === undefined)
        values = {};

    if (!(values instanceof Object || Object.isPrototypeOf(values) || typeof (values) === 'object'))
        values = {};

    var chunkIndex        = 0;
    var placeholdersRegex = /{@(.*?)}/g;
    var result            = '';
    var valuesIndex       = 0;
    var match, value;

    while (match = placeholdersRegex.exec(sql))
    {
        //ToDo Check if surrounded by quotes or not ..?
        value = values[match[1]];
        value = this.escape(value == undefined ? '' : value);
        //this.escapeId(..?)

        if (value.substr(0, 1) == "'" && value.substr(value.length - 1) == "'")

            value = value.substr(1, value.length - 2);

        result += sql.slice(chunkIndex, match.index) + value;
        chunkIndex = placeholdersRegex.lastIndex;
    }

    if (chunkIndex === 0)
    {
        // Nothing was replaced
        if (global.logSQL)
            console.log(sql);

        return sql;
    }

    if (chunkIndex < sql.length)

        result += sql.slice(chunkIndex);

    if (global.logSQL)
        console.log(result);

    return result;
}

class Mysql
{
    constructor(config)
    {
        this.servers = config.server ? config.server : [];
        this.onConnectedCallbacks = [];
        this.username = config.user;
        this.password = config.password;
        this.database = config.database;
        this.tringConnect = 0;
        this.connection = null;
        this.actualHost = null;
        this.callbackIncrement = 0;
        this.actualPing = -1;
        this.awaitingPerconna = false;
        this.clusterAddresses = '';
        this.usePerconna = true;

        if (typeof (this.servers) === 'string')
            this.servers = [this.servers];

        this.connect();

        var _this = this;
        (setInterval(function()
        {
            _this.connect();
        }, 10 * 1000)).unref(); //Every 10 seconds

        //ToDo check for average response time of a server in order to check the nearest server
        //random sort servers array before testing in order to get the response time in different situations ..?
    }

    emitConnected()
    {
        try
        {
            if (this.connection == null || this.actualPing < 0)
            {
                if (this.tringConnect === 0)
                    this.connect();

                return;
            }

            if (this.connection.stream.writable == false || this.connection.stream.readable == false)
            {
                this.connection = null;
                this.actualPing = -1;
                this.actualHost = null;

                if (this.tringConnect === 0)
                    this.connect();

                console.warn('connection destroyed, try to reconnect');
                return;
            }

            var callbacks = this.onConnectedCallbacks;
            this.onConnectedCallbacks = [];
            for (var key in callbacks)
            {
                try
                {
                    callbacks[key].method.call(this, this.connection, this.actualPing);
                }
                catch (e)
                {
                    console.error(e);
                }
            }
        }
        catch (e)
        {
            this.connection = null;
            this.actualPing = -1;
            this.actualHost = null;
            console.error(e);
        }
    }

    onConnected(cb)
    {
        var obj = {
            method: cb,
            id: this.callbackIncrement++
        };

        this.onConnectedCallbacks.push(obj);
        this.emitConnected();

        return obj;
    }

    removeOnConnected(id)
    {
        try
        {
            if (typeof (id) === 'object')

                id = id.id;

            var onConnecteds = this.onConnectedCallbacks;
            this.onConnectedCallbacks = [];

            for (var key in onConnecteds)
            {
                if (onConnecteds[key].id != id)

                    this.onConnectedCallbacks.push(onConnecteds[key]);
            }
        }
        catch (e)
        {
            console.error(e);
        }
    }

    tryServer(host)
    {
        this.tringConnect++;

        var port = 3306;
        var index = host.indexOf(':');

        if (index != -1)
        {
            port = host.substr(index + 1);
            host = host.substr(0, index);
        }

        var _this = this;

        mysql.createConnection({host: host, port: port, user: this.username, password: this.password, database: this.database, queryFormat: queryFormat})
        .then(function(connection)
        {
            _this.tringConnect--;

            connection = connection.connection;
            var start = (new Date()).getTime();

            connection.ping(function()
            {
                try
                {
                    var time = (new Date()).getTime() - start;

                    if (time < _this.actualPing || _this.actualPing == -1 || _this.connection == null)
                    {
                        if (_this.actualHost !== host)
                        {
                            var oldConnection = _this.connection;
                            if (oldConnection != null)
                            {
                                setTimeout(function()
                                {
                                    try
                                    {
                                        oldConnection.end();
                                    }
                                    catch (e)
                                    {
                                        console.error(e);
                                    }
                                }, 5000);
                            }

                            _this.connection = connection;
                            console.info('Using mysql server ' + host + ', ping: ' + time);
                        }
                        else
                        {
                            connection.end();
                        }

                        _this.actualHost = host;
                        _this.actualPing = time;
                        _this.emitConnected();
                    }
                    else

                        connection.end();
                }
                catch (e)
                {
                    connection.end();
                    console.error(e);
                }
            });
        })
        .catch(function(err)
        {
            _this.tringConnect--;
            //console.error(err);
        });
    }

    connect()
    {
        try
        {
            if (this.connection !== null)
            {
                if (this.connection.stream.writable == false || this.connection.stream.readable == false)
                {
                    console.warn('connection destroyed, try to reconnect');
                    this.connection = null;
                    this.actualPing = -1;
                    this.actualHost = null;
                }
            }
        }
        catch (e)
        {
            console.error(e);
        }

        try
        {
            for (var key in this.servers)
            {
                try
                {
                    this.tryServer(this.servers[key]);
                }
                catch (e)
                {
                    console.error(e);
                }
            }

            this.updatePerconnaServers();
        }
        catch (e)
        {
            console.error(e);
        }
    }

    updatePerconnaServers()
    {
        if (this.awaitingPerconna || !this.usePerconna)
            return;

        this.awaitingPerconna = true;
        const _this = this;

        this.query('select VARIABLE_VALUE FROM performance_schema.global_status WHERE VARIABLE_NAME="wsrep_incoming_addresses"').then(function(result)
        {
            _this.awaitingPerconna = false;

            try
            {
                if (result.length == 0)
                    return;

                if (_this.clusterAddresses !== result[0].VARIABLE_VALUE)
                {
                    _this.clusterAddresses = result[0].VARIABLE_VALUE;
                    console.info('Updating mysql cluster: ' + _this.clusterAddresses);
                }

                result = result[0].VARIABLE_VALUE.split(',');
                for (var key in result)
                {
                    try
                    {
                        var host = result[key];
                        if (_this.servers.indexOf(host) == -1)
                        {
                            _this.servers.push(host);
                            _this.tryServer(host);
                        }
                    }
                    catch (e)
                    {
                        console.error(e);
                    }
                }
            }
            catch (e)
            {
                console.error(e);
            }
        })
        .catch(function(err)
        {
            if(err.message === "Table 'performance_schema.global_status' doesn't exist")
            {
                console.info('Disabling perconna support');
                _this.usePerconna = false;
                return;
            }

            _this.awaitingPerconna = false;
        });
    }

    //--------------------------------

    queryWithFields(sql, vars, subConsole)
    {
        if (vars === undefined || vars === null)
            vars = [];

        var _this = this;
        var stack = new Error();

        return new Promise(function(resolve, reject)
        {
            var onConObj;
            var didTimeout = false;

            var timeout = setTimeout(function()
            {
                didTimeout = true;
                reject('We could not connect to the database');

                if (onConObj)
                    _this.removeOnConnected(onConObj);
            }, 500);

            timeout.unref();

            onConObj = _this.onConnected(function(connection)
            {
                if (didTimeout)
                    return;

                try
                {
                    clearTimeout(timeout);
                }
                catch (e)
                {
                    console.error(e);
                }

                try
                {
                    connection.query({
                        sql: sql,
                        timeout: 2000, // 2s
                        values: vars
                    },
                    function(err, results, fields)
                    {
                        if (err)
                        {
                            if (err.code === 'ETIMEDOUT')
                            {
                                _this.connection = null;
                                _this.actualPing = -1;
                                _this.actualHost = null;
                            }

                            if(err.message === "Table 'performance_schema.global_status' doesn't exist")
                            {
                                reject(err);
                                return;
                            }

                            stack.message = err.message;
                            stack.code = err.code;
                            stack.showIntercept = false;

                            //const index = stack.stack.indexOf('api/ApiEnvironment.js:57:2');
                            //if(index !== -1)
                            //    stack.stack = stack.stack.substr(0, index);

                            if(!process.options['disable-mysql-errors'])
                            {
                                if(subConsole)
                                    subConsole.error(stack);
                                else
                                    console.error(stack);
                            }

                            reject(stack);
                        }
                        else
                            resolve({result: results, fields: fields});
                    });
                }
                catch (e)
                {
                    _this.connection = null;
                    _this.actualPing = -1;
                    this.actualHost = null;
                    console.error(e);
                    reject(e);
                }
            });
        });
    }

    query(sql, vars, console)
    {
        var _this = this;
        return new Promise(function(resolve, reject)
        {
            _this.queryWithFields(sql, vars, console).then(function(data)
            {
                if(!data.result.map)
                    return resolve(data.result);

                const fieldTypes = {};

                for(var key in data.fields) {
                    const f = data.fields[key];
                    fieldTypes[ f.name ] = f.columnType;
                }

                resolve(data.result.map(function(obj) {
                    for(var key in obj) {
                        if(fieldTypes[key] === 246 && obj[key] !== null)
                            obj[key] = parseFloat(obj[key]);
                    }

                    return obj;
                }));
            })
            .catch(function(err)
            {
                reject(err);
            });
        });
    }

    query_prepare(sql, vars)
    {
        return queryFormat(sql, vars);
    }
}

Mysql.queryFormat = queryFormat;
module.exports = Mysql;