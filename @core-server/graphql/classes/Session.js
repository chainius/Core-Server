const query = require('../lib/query')

class Session extends SuperClass {

    handleSocketMessage(socket, message) {
        if(message.query !== undefined || message.live !== undefined || message.bulk || message.live !== undefined)
            return query(this, socket, message)

        super.handleSocketMessage(socket, message)
    }

}

module.exports = Session