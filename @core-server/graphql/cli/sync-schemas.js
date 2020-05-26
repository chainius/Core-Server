const GraphDB = plugins.require('graphql/GraphDb')
const checkIndexes = require('./check-indexes')

module.exports = async function() {
    var config = plugins.getProjectConfig('servers').mysql
    GraphDB.construct(config.host, config.user, config.password || config.pass,  config.database || config.db)
    const { sequelize } = GraphDB

    // if(triggers !== 't' && triggers !== 'triggers') {
        try {
            const start = new Date().getTime();
            //await mysqldump(dumpConfig);
            const timeDump = new Date().getTime();
            console.log('Mysqldump took:', timeDump - start, 'ms.');
            await sequelize.sync({
                alter: true
            });
            const timeSync = new Date().getTime();
            console.log('Sequelize sync took:', timeSync - timeDump, 'ms.');
        } catch(e) {
            if (e.sql) {
              console.log('Sync error sql:  ', e.sql);
            }
            throw(e);
        }
    // }

    // try {
    //   const timeSync = new Date().getTime();
    //   await sequelize.syncTriggers();
    //   console.log('Sequelize triggers took:', new Date().getTime() - timeSync, 'ms.');
    // } catch(e) {
    //     if (e.sql) {
    //         console.log('Sync error sql:  ', e.sql);
    //     }
    
    //     throw(e);
    // }

    if(process.options['no-indexes'] === undefined)
        await checkIndexes(sequelize);

    console.log('Done!');
    process.exit(0);
}