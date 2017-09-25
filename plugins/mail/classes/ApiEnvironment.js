class ApiEnvironment extends SuperClass
{

    //----------------------------------------------------
    //Mail environment functions

    /*logMailSend(user_id, send_adress, recv_address, recv_name, subject, message)
    {
        const params = {
            user_id: user_id,
            send_address: send_adress,
            recv_address: recv_address,
            recv_name: recv_name,
            subject: subject,
            message: message
        };

        return this.query("INSERT INTO mails(user_id, send_address, recv_address, recv_name, subject, message, request_date, locked) VALUES('{@user_id}', '{@send_address}', '{@recv_address}', '{@recv_name}', '{@subject}', '{@message}', now(), '0')", params);
    }

    logMailError(mail_id, error)
    {
        consoe.error('mail', error);

        var params = {
            mail_id: mail_id,
            error: error
        };

        return this.query("INSERT INTO mail_fails(mail_id, fail_date, fail_description) VALUES('{@mail_id}', now(), '{@error}')", params);
    }*/

    /**
    * send a mail
    * @param user_id {Numeric}
    * @param email {String}
    * @param layout_name {String}
    * @param data {Object}
    */
    /*async mail(user_id, email, layout, data)
    {
        data = data || this.post;
        var _this = this;

        var recv_name = '';
        var subject   = '';
        var message   = '';
        const mymail  = this.siteManager.config.mail.user;
        const myname  = this.siteManager.mailName || this.siteManager.title;

        try {

            const info = await parseMailLayout(Path.join(process.cwd(), 'mails'), layout, data);

            info.name = myname;
            info.destination = email;
            info.source = mymail;

            //recv_name = '';
            subject = info.subject;
            message = info.html;

            this.logMailSend(user_id, info.source, email, recv_name, subject, message).catch(function(err)
            {
                console.error(err);
            });

            return await __sendMail(info);

        } catch(e) {

            const result = await this.logMailSend(user_id, mymail, email, recv_name, subject, message);

            if (result.insertId)
                await this.logMailError(result.insertId, err.message);

            throw(e);
        }
    }*/

}

module.exports = ApiEnvironment;