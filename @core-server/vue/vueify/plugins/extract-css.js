var fs = require('fs')
var compiler = require('../lib/compiler')
var CleanCSS = require('clean-css');

function minify(css) {
    return new CleanCSS({
        level: 2
    }).minify(css).styles;
}

function write(b, outPath, css) {
    if (typeof outPath === 'object' && outPath.write) {
        outPath.write(css)
        outPath.end()
    } else if (typeof outPath === 'string') {
        fs.writeFile(outPath, css, function (err) {
            if (err)
                console.error(err);
        })
    }
}

module.exports = function (b, opts) {
    compiler.applyConfig({
        extractCSS: true
    })

    var styles = b._options.stylesCache;

    var outPath = opts.out || opts.o || 'bundle.css'

    b.on('bundle', function (bs) {
        bs.on('end', function () {
            var css = Object.keys(styles)
                .map(function (file) {
                    return styles[file]
                })
                .join('\n')

            if (opts.minify)
                css = minify(css);

            write(b, outPath, css);

        })
    })

    b.on('transform', function (tr, file) {
        if (tr.vueify) {
            tr.on('vueify-style', function (e) {
                styles[e.file] = e.style
            })
        }
    })
}
