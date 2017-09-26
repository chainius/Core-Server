class ApiEnvironment extends SuperClass {

    getConnections() {
        return this.siteManager.connections || {};
    }

    /**
    * send a query to the database
    * @param sql {String}
    * @param vars {Object}
    */
    async query(sql, vars)
    {
        if (vars === undefined || vars === null)
            vars = this.post;

        vars['auth_id'] = this.session['auth_id'];

        if (this.queryVars)
        {
            for (var key in this.queryVars)
                vars[key] = this.queryVars[key];
        }

        const database = this.getConnections().mysql;
        if (!database)
            throw('No Mysql connection found');

        return await database.query(sql, vars, this.console);
    }

    /**
    * send a query to the database and get the first row
    * @param sql {String}
    * @param vars {Object}
    * @param default
    */
    async query_object(sql, vars, def)
    {
        const result = await this.query(sql, vars);

        if (result.length === 0 || result[0] === undefined)
        {
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
    query_prepare(sql, vars)
    {
        const database = this.getConnections().mysql;

        if(!database)
            return sql;

        return plugins.require('databases/Mysql').queryFormat.call(database.connection, sql, vars);
    }

}

module.exports = ApiEnvironment;