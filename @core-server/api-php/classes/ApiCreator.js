var runner = require("child_process")
var Path = require('path')
var fs = require('fs')

function tryParseJson(msg) {
    try {
        return JSON.parse(msg)
    } catch(e) {

    }

    return msg
}


class ApiCreator extends SuperClass {

    create(path, name) {
        const handler = this.createPhpHandler(path + '.php', name)

        if (handler != false)
            return { handler: handler, path: path + '.php' }

        return super.create(path, name)
    }

    createPhpHandler(path, name) {
        if(!fs.existsSync(path))
            return false

        return async function() {
            const _this = this

            var cmd = "php '" + Path.join(process.cwd(), 'plugins', 'phpcore.php') + "'"

            if(process.platform.toString().toLowerCase().indexOf('win32') > -1) {
                cmd = "php " + Path.join(process.cwd(), 'plugins', 'phpcore.php')
            }

            const Run = new Promise(function(resolve, reject) {

                runner.exec(cmd,
                    {
                        env:
                    {
                        post:         JSON.stringify(_this.post),
                        session:      JSON.stringify(_this.session),
                        cookie:       JSON.stringify(_this.cookie),
                        client_ip:    _this.client_ip,
                        actions_path: Path.join(process.cwd(), 'api'),
                        api_exec:     Path.normalize(path)
                    }
                    },
                    function(err, phpResponse, stderr) {
                        if(err) {
                            reject(tryParseJson(stderr ? stderr : phpResponse))
                        } else {
                            var json = tryParseJson(phpResponse)
                            if(json['__core__[mails]__']) {
                                var mails = json['__core__[mails]__']

                                for(var key in mails) {
                                    var mail = mails[key]
                                    var vars = mail['vars']
                                    that.mail(vars['user_id'], vars['dest_mail'], mail['layout'], vars)
                                }

                                delete json['__core__[mails]__']
                            }

                            resolve(json)
                        }
                    })

            })

            return await Run
        }
    }
}

module.exports = ApiCreator