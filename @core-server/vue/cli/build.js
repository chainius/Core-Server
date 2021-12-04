const cluster = require('cluster')
const chalk = require('chalk')
const UglifyJS = require('uglify-es')
const Path = require('path')
const fs = require('fs')

function minifyBundle(path, mode) {
    console.log(chalk.blue('Minify '+mode+' bundle..'))

    const result = UglifyJS.minify(fs.readFileSync(path).toString())

    if (result.error) {
        console.error(chalk.red('['+mode+' Minify]'), chalk.red(result.error))
        console.error(result.error)
        process.exit(1)
    }

    if (!result.code) {
        console.error(chalk.red('['+mode+' Minify]'), chalk.red(result))
        process.exit(1)
    }

    fs.writeFile(path, result.code, function() {
        console.log(chalk.green(mode + ' minify done..'))
        process.exit(0)
    })
}

function workerCompile(value) {
    const bundle = require('./bundle.js')

    bundle(value, function() {
        minifyBundle(Path.join(process.cwd(), 'dist', 'bundle-' + value + '.js'), value)
    })

}

module.exports = function(value) {

    if(cluster.isWorker || value !== null) {
        workerCompile(value)
    } else {
        cluster.on('exit', (worker, code, signal) => {
            if (code !== 0)
                process.exit(code)
        })

        cluster.fork({ cli: JSON.stringify({ build: 'client', production: true }) })
        cluster.fork({ cli: JSON.stringify({ build: 'server', production: true }) })
    }

    return false
}