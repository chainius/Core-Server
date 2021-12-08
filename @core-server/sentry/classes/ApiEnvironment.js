class ApiEnvironment extends SuperClass {
    api(name, post) {
        post = post || this.post
        return this.sessionObject.api(name, post, Object.assign({
            $sentryTransaction: this.$sentryTransaction,
        }, this.$req))
    }
}

module.exports = ApiEnvironment