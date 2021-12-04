const Path = require('path')

class ApiEnvironment extends SuperClass {

    //----------------------------------------------------
    // Mail environment functions

    /**
    * send a mail
    * @param user_id {Numeric}
    * @param email {String}
    * @param layout_name {String}
    * @param data {Object}
    */
    async mail(user_id, email, layout, data) {
        const Mailer = plugins.require('mail/Mailer')

        data = data || this.post

        var recv_name = ''
        var subject = ''
        var message = ''
        const mymail = this.siteManager.getConfig('servers').mail.user
        const myname = this.siteManager.getConfig('servers').mail.name || mymail

        try {
            const info = await Mailer.parseLayout(Path.join(process.cwd(), 'mails'), layout, data)

            info.name = myname
            info.destination = email
            info.source = mymail

            // recv_name = '';
            subject = info.subject
            message = info.html

            return {
                result: await Mailer.send(info),

                send_mail: mymail,
                send_name: myname,
                recv_mail: email,
                recv_name: recv_name,
                subject:   subject,
                message:   message,
            }
        } catch(e) {

            e.send_mail = mymail
            e.send_name = myname
            e.recv_mail = email
            e.recv_name = recv_name
            e.subject = subject
            e.message = message

            e.message = e.message || e.code || 'An error occured while sending the email'
            throw(e)
        }
    }

}

module.exports = ApiEnvironment