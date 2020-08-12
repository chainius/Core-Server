const GraphDB = plugins.require('graphql/GraphDb')
const sequelize = require('sequelize')

class ApiEnvironment extends SuperClass {

    grahpql(query) {
        return "todo"
    }

    get schemas() {
        return this.siteManager.schemas
    }

    get sequelize() {
        return GraphDB.sequelize
    }

    /**
    * send a query to the database
    * @param sql {String}
    * @param vars {Object}
    */
   async query(sql, vars, config = {}) {
       return GraphDB.sequelize.query( this.query_prepare(sql, vars), Object.assign({ type: sequelize.QueryTypes.SELECT }, config) )
   }

   /**
   * send a query to the database and get the first row
   * @param sql {String}
   * @param vars {Object}
   * @param default
   */
   async query_object(sql, vars, def) {
       const result = await this.query(sql, vars);

       if (result.length === 0 || result[0] === undefined) {
           if(def !== undefined)
               return def;
           else
               throw('No results found');
       }

       return result[0];
   }

   /**
   * Prepare an sql statement (for debug testing)
   * @param sql {String}
   * @param vars {Object}
   */
   query_prepare(sql, vars) {
        if (vars === undefined || vars === null)
           vars = this.post;

        vars['auth_id'] = this.session['auth_id'];
        if (this.queryVars) {
            for (var key in this.queryVars)
                vars[key] = this.queryVars[key];
        }

        return queryFormat(sql, vars);
   }

}

module.exports = ApiEnvironment

// -----------

function queryFormat(sql, values) {
    if (values === null || values === undefined)
        values = {};

    if (!(values instanceof Object || Object.isPrototypeOf(values) || typeof (values) === 'object'))
        values = {};

    var chunkIndex        = 0;
    var placeholdersRegex = /{@(.*?)}/g;
    var result            = '';
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