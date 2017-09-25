const MongoClient = require('mongodb').MongoClient
const events      = require('events');

class MongoDb extends events.EventEmitter
{
    constructor(config)
    {
        super();
        this.config = config;
        this.client = null;

        this.connect();
    }

    connect()
    {
        const _this = this;
        MongoClient.connect('mongodb://' + this.config.server + '/' + this.config.project, function(err, db) {
            if(err !== null)
            {
                console.error('Could not connect to the mongodb server');

                setTimeout(function()
                {
                    _this.connect();
                }, 10000); //10 seconds
            }

            _this.client = db;
            console.info('MongoDb client successfully connected');
            _this.emit('connected', _this);
        });
    }

    onConnected(timeout)
    {
        const _this = this;
        return new Promise(function(resolve, reject)
        {
            if(_this.client !== null)
                return resolve();

            var resolved = false;
            function cbCaller()
            {
                resolved = true;
                resolve();
            }

            _this.once('connected', cbCaller);

            setTimeout(function()
            {
                if(!resolved)
                {
                    _this.removeListener('connected', cbCaller);
                    reject('Timeout expired');
                }
            }, timeout || 5000);
        });
    }

    collection(name)
    {
        return new Collection(this, name);
    }

    async nativeCall(fn)
    {
        const client = await this.onConnected();
        return await (new Promise(function(resolve, reject)
        {
            fn(client, function(err, result)
            {
                if(err)
                    reject(err);
                else
                    resolve(result);
            });
        }));
    }

    collections()
    {
        return this.nativeCall(function(client, cb)
        {
            client.listCollections().toArray(cb);
        });
    }
}

class Collection
{
    constructor(mongodb, name)
    {
        this.mongodb = mongodb;
        this.name    = name;
        this.native  = null;
    }

    async getNative()
    {
        if(this.native !== null)
            return this.native;

        await this.mongodb.onConnected();
        this.native = this.mongodb.client.collection(this.name);
        return this.native;
    }

    async nativeCall(fn)
    {
        const collection = await this.getNative();

        return await (new Promise(function(resolve, reject)
        {
            fn(collection, function(err, result)
            {
                if(err)
                    reject(err);
                else
                    resolve(result);
            });
        }));
    }

    insert(data)
    {
        return this.nativeCall(function(collection, cb)
        {
            collection.insertOne(data, cb);
        });
    }

    insertMany(data)
    {
        return this.nativeCall(function(collection, cb)
        {
            collection.insertMany(data, cb);
        });
    }

    bulkWrite(data)
    {
        return this.nativeCall(function(collection, cb)
        {
            collection.bulkWrite(data, cb);
        });
    }

    update(data, update)
    {
        return this.nativeCall(function(collection, cb)
        {
            collection.updateOne(data, update, cb);
        });
    }

    delete(data)
    {
        return this.nativeCall(function(collection, cb)
        {
            collection.deleteOne(data, cb);
        });
    }

    deleteMany(data)
    {
        return this.nativeCall(function(collection, cb)
        {
            collection.deleteMany(data, cb);
        });
    }

    find(data)
    {
        return this.nativeCall(function(collection, cb)
        {
            collection.find(data).toArray(cb);
        });
    }

    findOneAndDelete(data)
    {
        return this.nativeCall(function(collection, cb)
        {
            collection.findOneAndDelete(data, cb);
        });
    }

    findAndDelete(data)
    {
        return this.nativeCall(function(collection, cb)
        {
            collection.findAndRemove(data, cb);
        });
    }

    findOneAndReplace(data, data2)
    {
        return this.nativeCall(function(collection, cb)
        {
            collection.findOneAndReplace(data, data2, cb);
        });
    }

    aggregation(data, cursor)
    {
        return this.nativeCall(function(collection, cb)
        {
            collection.aggregation(data, cursor, cb);
        });
    }
}

MongoDb.Collection = Collection;
module.exports = MongoDb;