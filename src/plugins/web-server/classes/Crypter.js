const crypto         = require('crypto');
const base32         = require('hi-base32');
const ReCAPTCHA      = require('recaptcha2');
const GAuthenticator = require('google_authenticator').authenticator;

var iv = '';
var recaptcha = null;

/** Crypter */
class Crypter
{
    setCrypterIv(_iv)
    {
        iv = _iv;
    }

    setRecaptchaConfig(config)
    {
        recaptcha = new ReCAPTCHA(config);
    }

    /**
    * @param secret {String}
    * @param length {Number}
    */
    paddedSecret(secret, length)
    {
        if (secret.length > length)
            secret = this.sha1(secret);

        for (var i = secret.length; i < length; i++)
            secret += '\0';

        return secret.substr(0, length);
    }

    /**
    * @param algo {String}
    * @param length {Number}
    * @param content {String}
    * @param secret {String}
    */
    decryptAlgo(algo, length, content, secret, subIv)
    {
        try
        {
            secret = this.paddedSecret(secret, length);
            content = Buffer.from(content, 'base64');

            var decipher = crypto.createDecipheriv(algo, secret, subIv || iv);
            decipher.setAutoPadding(true);
            var dec = decipher.update(content);
            dec += decipher.final('utf8');
            return dec;
        }
        catch (e)
        {
            return false;
        }
    }

    decryptOld(content, secret)
    {
        return this.decryptAlgo('aes-128-cbc', 16, content, secret);
    }

    /**
    * @param content {String}
    * @param secret {String}
    */
    decrypt(content, secret, subIv)
    {
        return this.decryptAlgo('aes256', 32, content, secret, subIv);
    }

    /**
    * @param content {String}
    * @param secret {String}
    */
    encrypt(content, secret, subIv)
    {
        try
        {
            secret = this.paddedSecret(secret, 32);
            var decipher = crypto.createCipheriv('aes256', secret, subIv || iv);
            decipher.setAutoPadding(true);
            var dec = decipher.update(content, 'utf8', 'base64');
            dec += decipher.final('base64');
            return dec;
        }
        catch (e)
        {
            console.error(e);
        }

        return false;
    }

    /**
    * @param content {String}
    * @param secret {String}
    */
    decryptJSON(content, secret)
    {
        content = this.decrypt(content, secret);

        if (content === false)
            return false;

        try
        {
            content = JSON.parse(content);
            return content;
        }
        catch (e)
        {
            return false;
        }
    }

    decryptOldJSON(content, secret)
    {
        content = this.decryptOld(content, secret);

        if (content === false)
            return false;

        try
        {
            content = JSON.parse(content);
            return content;
        }
        catch (e)
        {
            return false;
        }
    }

    /**
    * @param secret {String}
    * @param token {Number}
    * @param codeLength {Number} default 6
    */
    verifyToken(secret, token, codeLength)
    {
        if (!codeLength)
            codeLength = 6;

        const auth = new GAuthenticator(codeLength);
        return auth.verifyCode(secret, token, 3);
    }

    /**
    * @param token {Number}
    */
    verifyCaptcha(token)
    {
        return (recaptcha === null) ? false : recaptcha.validate(token);
    }

    /**
    * @param content {String}
    */
    sha1(content)
    {
        return crypto.createHash('sha1').update(content, 'utf8').digest().toString('base64');
    }

    /**
    * @param content {String}
    */
    sha1Hex(content)
    {
        return crypto.createHash('sha1').update(content, 'utf8').digest().toString('hex');
    }

    /**
    * @param content {String}
    */
    sha2(content)
    {
        return crypto.createHash('sha256').update(content, 'utf8').digest().toString('base64');
    }

    /**
    * @param content {String}
    */
    base32Encode(content)
    {
        return base32.encode(content);
    }

    /**
    * @param content {String}
    */
    base32Decode(secret)
    {
        return base32.decode(secret);
    }
}

module.exports = new Crypter();