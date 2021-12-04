class ApiEnvironment extends SuperClass {

    /**
    * Send a task over the network
    * @param name {String}
    * @param task {Object}
    */
    sendTask(name, task) {
        return this.siteManager.sendTask(name, task)
    }

}

module.exports = ApiEnvironment