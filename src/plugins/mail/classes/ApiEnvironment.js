class ApiEnvironment extends SuperClass
{

    //----------------------------------------------------
    //Mail environment functions

    /**
    * send a mail
    * @param user_id {Numeric}
    * @param email {String}
    * @param layout_name {String}
    * @param data {Object}
    */
    async mail(user_id, email, layout, data)
    {
        const Mailer = plugins.require('mail/Mailer');

        data = data || this.post;

        var recv_name = '';
        var subject   = '';
        var message   = '';
        const mymail  = this.siteManager.config.mail.user;
        const myname  = this.siteManager.mailName || this.siteManager.title;

        const info = await Mailer.parseLayout(Path.join(process.cwd(), 'mails'), layout, data);

        info.name = myname;
        info.destination = email;
        info.source = mymail;

        //recv_name = '';
        subject = info.subject;
        message = info.html;

        return await Mailer.send(info);
    }

}

module.exports = ApiEnvironment;