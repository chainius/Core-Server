var fs = require('fs')
var path = require('path')
var assign = require('object-assign')
var ensureRequire = require('../ensure-require')

var defaultBabelOptions = {
  presets: ['env'],
  plugins: ['transform-runtime']
}

var babelRcPath = path.resolve(process.cwd(), '.babelrc')
var babelOptions = fs.existsSync(babelRcPath)
  ? getBabelRc() || defaultBabelOptions
  : defaultBabelOptions

function getBabelRc () {
  var rc
  try {
    rc = JSON.parse(fs.readFileSync(babelRcPath, 'utf-8'))
  } catch (e) {
    throw new Error('[vueify] Your .babelrc seems to be incorrectly formatted.')
  }
  return rc
}

module.exports = function (raw, cb, compiler, filePath) {
  if (babelOptions === defaultBabelOptions) {
    try {
      ensureRequire('babel', ['babel-preset-env', 'babel-runtime', 'babel-plugin-transform-runtime'])
    } catch (e) {
      console.error(e.message)
      console.error(
        '\n^^^ You are seeing this because you are using Vueify\'s default babel ' +
        'configuration. You can override this with .babelrc or the babel option ' +
        'in vue.config.js.'
      )
    }
  }

  try {
    var babel = require('babel-core')
    var options = assign({
      comments: false,
      filename: filePath,
      sourceMaps: compiler.options.sourceMap
    }, compiler.options.babel || babelOptions)
    var res = babel.transform(raw, options)
  } catch (err) {
    return cb(err)
  }
  cb(null, res)
}
