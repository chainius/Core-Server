const chalk     = require('chalk');
const fs        = require('fs');
const Path      = require('path');
const decomment = require('decomment');
const collapse  = require('condense-whitespace');
const subConsole = console.create('PHP');

const phpPath   = Path.join(process.cwd(), 'plugins', 'phpcore.php');

function bundlePhp(folder)
{
    var files;

    try
    {
        files = fs.readdirSync(folder);
    }
    catch (e)
    {
        return false;
    }

    var nindex      = '';
    var ncontent    = '';

    for (var key in files)
    {
        if (Path.extname(files[key]) !== '.php')
            continue;

        try
        {
            const content = fs.readFileSync(Path.join(folder, files[key])).toString();
            const index = content.indexOf('<?php');

            if (files[key] === 'index.php')
                nindex = content.substr(index + 5);

            else
                ncontent += content.substr(index + 5) + '\n';
        }
        catch (e)
        {
            subConsole.error(e);
        }
    }

    if (nindex !== '')
        ncontent = nindex.replace('@phpcore;', ncontent);

    ncontent = '<?php\n' + decomment.text(ncontent);
    return collapse(ncontent);
}

module.exports = function(value)
{
    if (value === 'size')
    {
        try {
            const fs    = require('fs');
            const stats = fs.statSync(phpPath);
            const fileSizeInKB = Math.round(stats.size / 1000.0);

            subConsole.log('PHP Bundle size: ' + fileSizeInKB + ' KB');
        } catch(e) {
            if(e.code === 'ENOENT')
                subConsole.error('PhpBundle not bundled yet, the bundle size could not be evaluated');
        }
    }
    else
    {
        const php = bundlePhp(Path.join(__dirname, '..', 'php'));

        if (php === false)
            return false;

        fs.writeFileSync(phpPath, php);

        subConsole.success('PHP core bundled');
    }

    return false;
};