const forge = require('node-forge')
const pki = forge.pki
const Path = require('path')
const fs = require('fs')

function generateKey(attrs, issuer) {
    const keys = pki.rsa.generateKeyPair(2048)
    const cert = pki.createCertificate()
    cert.publicKey = keys.publicKey
    cert.serialNumber = '01'
    cert.validity.notBefore = new Date()
    cert.validity.notAfter = new Date()
    cert.validity.notAfter.setFullYear(cert.validity.notBefore.getFullYear() + 15)

    if(!issuer)
        issuer = attrs

    cert.setSubject(attrs)
    cert.setIssuer(issuer)

    //-------------------------------------------------------------------------------------

    cert.setExtensions([
        {
            name: 'basicConstraints',
            cA:   true
        },
        {
            name:             'keyUsage',
            keyCertSign:      true,
            digitalSignature: true,
            nonRepudiation:   true,
            keyEncipherment:  true,
            dataEncipherment: true
        },
        {
            name:            'extKeyUsage',
            serverAuth:      true,
            clientAuth:      true,
            codeSigning:     true,
            emailProtection: true,
            timeStamping:    true
        },
        {
            name:    'nsCertType',
            client:  true,
            server:  true,
            email:   true,
            objsign: true,
            sslCA:   true,
            emailCA: true,
            objCA:   true
        },
        {
            name: 'subjectKeyIdentifier'
        }
    ])

    cert.sign(keys.privateKey)

    return {
        cert: pki.certificateToPem(cert),
        key:  pki.privateKeyToPem(keys.privateKey)
    }
}

function mkdir(path) {
    return new Promise(function(resolve) {
        fs.mkdir(path, function(err) {
            if (err) {
                if (err.code == 'EEXIST') 
                    resolve()
                else 
                    reject(err)
            } else 
                resolve()
        })
    })
}

module.exports = function(value) {
    value = value || ('core-server.' + Math.random())
    console.log('Generating ca with commonName', value)

    const info = [
        {
            name:  'commonName',
            value: value
        },
        {
            name:  'countryName',
            value: 'CS'
        },
        {
            shortName: 'ST',
            value:     'Core-Server'
        },
        {
            name:  'localityName',
            value: 'Internal CA'
        },
        {
            name:  'organizationName',
            value: 'Core-Server SSL'
        }
    ]

    const pem = generateKey(info)

    console.log('CA certificate generated')

    mkdir(Path.join(process.cwd(), 'ssl')).then(function() {
        fs.writeFileSync(Path.join(process.cwd(), 'ssl', 'ca.pem'), pem.cert)
        fs.writeFileSync(Path.join(process.cwd(), 'ssl', 'ca-key.pem'), pem.key)
    })
        .catch(function(err) {
            console.error(err)
        })

    return false
}