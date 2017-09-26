const fs         = require('fs');
const Path       = require('path');
const placeholdersRegex = /{@(.*?)}/g;
const nodemailer = require('nodemailer');
const htmlToText = require('html-to-text');
const jsesc      = require('jsesc');

function parseMailLayout(baseDir, layout, data)
{
    return new Promise(function(resolve, reject)
    {
        var result = '';
        var match, value;
        var chunkIndex        = 0;

        fs.readFile(Path.join(baseDir, 'layout.html'), function(err, htmlLayout)
        {
            if (err)
                return reject(err);

            htmlLayout = htmlLayout.toString();
            fs.readFile(Path.join(baseDir, layout + '.html'), function(err, html)
            {
                if (err)
                    return reject(err);

                html = html.toString();
                //html = html.replace('{@content}', html2.toString());

                match = placeholdersRegex.exec(html);
                while (match)
                {
                    value = data[match[1]];
                    value = (value === undefined ? '' : value);

                    if (value.substr(0, 1) === "'" && value.substr(value.length - 1) === "'")

                        value = value.substr(1, value.length - 2);

                    result += html.slice(chunkIndex, match.index) + value;
                    chunkIndex = placeholdersRegex.lastIndex;
                    match = placeholdersRegex.exec(html);
                }

                if (chunkIndex !== 0 && chunkIndex < html.length)

                    result += html.slice(chunkIndex);

                var index = result.indexOf('\n');
                var subject = result.substr(0, index);
                html = htmlLayout.replace('{@content}', result.substr(result.indexOf('\n', index + 1) + 1));

                resolve({
                    subject: subject,
                    html: html
                });
            });
        });
    });
}

function sendMail(options)
{
    //options.subject
    //options.html
    //options.destination
    //options.source

    return new Promise(function(resolve, reject)
    {
        const server = plugins.getEntry('web-server/MasterServer');
        const config = server.siteManager.config.mail;
        const transporterConfig = {};

        if(config.service === 'gmail')
        {
            transporterConfig.service = 'gmail';
            transporterConfig.auth = {
                user: config.user,
                pass: config.password
            }
        }

        let transporter = nodemailer.createTransport(transporterConfig);

        //To
        var from = options['source'];
        if (options.name !== undefined)

            from = "'" + jsesc(options.name) + "' <" + from + '>';

        const text = htmlToText.fromString(options.html, {
            wordwrap: 130
        });

        let mailOptions = {
            from: from,
            to: options.destination,
            subject: options.subject,
            text: text,
            html: options.html
        };

        // send mail with defined transport object
        transporter.sendMail(mailOptions, (error, info) =>
        {
            if (error)
                reject(error);
            else
                resolve(info);
        });
    });
}

global.parseMailLayout = parseMailLayout;
global.__sendMail = sendMail;