//sudo security add-trusted-cert -d -r trustRoot -k /Library/Keychains/System.keychain

const forge     = require('node-forge');
const fs        = require('fs');
const Path      = require('path');
const validPath = require('is-valid-path');
const ursa      = require('ursa'); //Faster key generation
const pki       = forge.pki;

function ValidateIPaddress(ipaddress) {
  return /^(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/.test(ipaddress);
}

class SSL
{
    constructor(ca_cert, ca_key)
    {
        this.issuer     = false;
        this.privatekey = false;
        //this.serialStart = 1; //ToDo

        if(ca_cert && ca_key)
        {
            this.loadCaCert(ca_cert);
            this.loadCaKey(ca_key);
        }
    }

    loadCaCert(ca_cert)
    {
        if(validPath(ca_cert))
            ca_cert = fs.readFileSync(Path.resolve(process.cwd(), ca_cert));

        var cert = pki.certificateFromPem(ca_cert);
        this.issuer = cert.issuer.attributes;
    }

    loadCaKey(ca_key)
    {
        if(validPath(ca_key))
            ca_key = fs.readFileSync(Path.resolve(process.cwd(), ca_key));

        this.privatekey = pki.privateKeyFromPem(ca_key);
    }

    setExtensions(cert, ips)
    {
        var altnames = [];

        for(var key in ips)
        {
            if(ValidateIPaddress(ips[key]))
            {
                altnames.push({
                    type: 7, // IP
                    ip:  ips[key]
                });
            }
            else
            {
                altnames.push({
                    type:  6, // URI
                    value: ips[key]
                });
            }
        }

        cert.setExtensions([
            {
                name: 'basicConstraints',
                cA: true
            },
            {
                name: 'keyUsage',
                keyCertSign: true,
                digitalSignature: true,
                nonRepudiation: true,
                keyEncipherment: true,
                dataEncipherment: true
            },
            {
                name: 'extKeyUsage',
                serverAuth: true,
                clientAuth: true,
                codeSigning: true,
                emailProtection: true,
                timeStamping: true
            },
            {
                name: 'nsCertType',
                client: true,
                server: true,
                email: true,
                objsign: true,
                sslCA: true,
                emailCA: true,
                objCA: true
            },
            {
                name: 'subjectAltName',
                altNames: altnames
            },
            {
                name: 'subjectKeyIdentifier'
            }
        ]);
    }

    generate(attrs, ips)
    {
        const _this = this;
        return new Promise(function(resolve, reject)
        {
            //pki.rsa.generateKeyPair({bits: 2048, workers: 2}, function(err, keypair)
            //{
            //    if(err)
            //        return reject(err);

            const keys      = ursa.generatePrivateKey(2048);

            const keypair = {
                publicKey: pki.publicKeyFromPem(keys.toPublicPem()),
                privateKey: pki.privateKeyFromPem(keys.toPrivatePem())
            };

            const cert = pki.createCertificate();
            cert.publicKey = keypair.publicKey;
            cert.serialNumber = '01'; //ToDo increment serial number or get hash to get it ?
            cert.validity.notBefore = new Date();
            cert.validity.notAfter = new Date();
            cert.validity.notAfter.setFullYear(cert.validity.notBefore.getFullYear() + 15);

            cert.setSubject(attrs);
            cert.setIssuer(_this.issuer || attrs);
            _this.setExtensions(cert, ips);

            cert.sign(_this.privatekey || keypair.privateKey);

            resolve({
                cert: pki.certificateToPem(cert),
                key:  pki.privateKeyToPem(keypair.privateKey)
            });
        });
        ///});
    }
}

module.exports = SSL;