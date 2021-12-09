class ApiEnvironment extends SuperClass {
    api(name, post) {
        this.$req.$sentryTransaction = this.$sentryTransaction
        return this.sessionObject.api(name, post || this.post, this.$req)
    }

    captureException(error, info = {}) {
        if(this.sessionObject.onException) {
            info.$sentryTransaction = info.$sentryTransaction || this.$sentryTransaction
            info.environment = info.environment || this
            info.name = info.name || this.name

            this.sessionObject.onException(error, info)
        }
    }
}

module.exports = ApiEnvironment