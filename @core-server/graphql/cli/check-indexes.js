const GraphDB = plugins.require('graphql/GraphDb')

var Sequelize;

function getTables() {
    return Sequelize.query("SHOW TABLES").then((res) => {
        return res[0].map((o) => Object.values(o)[0])
    })
}

function getIndexes(table) {
    return Sequelize.query("SHOW CREATE TABLE `"+table+"`").then((res) => {
        if(!res[0][0]['Create Table']) {
            console.warn('undefined create table', res[0][0])
            return
        }

        var sql = res[0][0]['Create Table'].split("\n");
        sql = sql.filter((o) => o.indexOf(' KEY `') !== -1 && o.indexOf('CONSTRAINT ') === -1);

        return sql.map((o) => {
            const index = o.indexOf('KEY `');
            const end   = o.indexOf("`", index+5);
            const fields = o.substr(end + 4, o.length - end - 7).split("`, `").sort().join(',')

            return {
                name: o.substr(index + 5, end-index - 5),
                fields:  fields
            }
        });
        
    });
}

function detectDuplicateKeys(table) {
    return getIndexes(table).then((indexes) => {
        return indexes.filter((value, index, self) => {
            return self.findIndex((val) => val.fields === value.fields) !== index;
        });
    })
}

async function removeDuplicateKeys(table) {
    const duplicates = await detectDuplicateKeys(table);
    
    for(var key in duplicates) {
        await Sequelize.query("ALTER TABLE `"+table+"` DROP INDEX `"+duplicates[key].name+"`;");
    }

    if(duplicates.length > 0)
        console.log(`removed ${duplicates.length} duplicate keys from table ${table}`);

    return duplicates;
}

module.exports = async function(seq) {
    try {
        if(typeof(seq) === "object") {
            Sequelize = seq;
        } else {
            var config = plugins.getProjectConfig('servers')
            GraphDB.construct(config.host, config.user, config.password || config.pass,  config.database || config.db)
            Sequelize = GraphDB.sequelize
        }

        const tables = await getTables();

        for(var x in tables) {
            await removeDuplicateKeys(tables[x]);
        }
    } catch(e) {
        console.error(e);
    }

    console.log('Done!');
    process.exit(0)
}