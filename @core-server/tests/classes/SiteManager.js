const Mocha = require('mocha')
const fs = require('fs')
const Path = require('path')

const testFolder = Path.join(process.cwd(), 'tests')

class SiteManager extends SuperClass {

    constructor(server) {
        super(server)

        if(process.options.test !== undefined) {
            process.nextTick(() => {
                this.executeTests()
            })
        }

    }

    executeTests() {
        const mocha = new Mocha({})

        fs.readdirSync(testFolder).forEach(file => {
            mocha.files.push(Path.join(testFolder, file))
        })

        mocha.run(function () {

            // ToDo exit process if with --tests argument

        })
    }

}

module.exports = SiteManager