const readline = require('readline');
const Path     = require('path');
const fs       = require('fs');

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

function ask(question, defaultValue)
{
    return new Promise(function(resolve, reject)
    {
        const add = (defaultValue === '') ? '' : '(' + defaultValue + ') ';
        rl.question(question + ': ' + add, (answer) => {
            if(answer === '')
                answer = defaultValue;

            resolve(answer);
        });
    });
}

function copyClientFile(name, dest) {
    const data = fs.readFileSync(Path.join(__dirname, '..', 'modules-www', 'template', name));
    fs.writeFileSync(dest, data);
}

function mkdir(path) {
    return new Promise(function(resolve)
    {
        fs.mkdir(path, function(err) {
            if (err) {
                if (err.code == 'EEXIST') resolve();
                else reject(err);
            } else resolve();
        });
    });
}

async function init()
{
    const config = {
        ui: 'yes',
        name: process.cwd().substr(Path.dirname(process.cwd()).length + 1),
        //version: '1.0.0',
        description: 'Core-Server project',
        'git repository': '',
        keywords: '',
        author: '',
        license: 'ISC'

    };

    for(var key in config)
        config[key] = await ask(key, config[key]);

    console.log('----------------------------------------------------------------');
    console.log('Creating initial files & directories...');

    //-----------------------------

    await mkdir(Path.join(process.cwd(), 'api'));
    await mkdir(Path.join(process.cwd(), 'config'));
    fs.writeFileSync(Path.join(process.cwd(), 'config', 'public-api.json'), JSON.stringify({connected:[], notconnected: [], everyone: [ '*/*' ]}, null, '\t'));
    fs.writeFileSync(Path.join(process.cwd(), '.babelrc'), '{ "presets": ["env"] }');
    fs.writeFileSync(Path.join(process.cwd(), '.gitignore'), 'node_modules/\ndist/\n.vscode\ncore-docs/');

    if(config.ui.substr(0,1).toLowerCase() === 'y')
    {
        fs.writeFileSync(Path.join(process.cwd(), 'config', 'servers.json'), JSON.stringify({}, null, '\t'));
        fs.writeFileSync(Path.join(process.cwd(), 'config', 'servers-production.json'), JSON.stringify({}, null, '\t'));
        await mkdir(Path.join(process.cwd(), 'plugins'));
        await mkdir(Path.join(process.cwd(), 'components'));
        await mkdir(Path.join(process.cwd(), 'components', 'home'));
        await mkdir(Path.join(process.cwd(), 'components', 'error'));
        await mkdir(Path.join(process.cwd(), 'menu'));
        await mkdir(Path.join(process.cwd(), 'resources'));
        await mkdir(Path.join(process.cwd(), 'resources', 'lib'));
        await mkdir(Path.join(process.cwd(), 'resources', 'img'));
        await mkdir(Path.join(process.cwd(), 'resources', 'css'));
        await mkdir(Path.join(process.cwd(), 'resources', 'fonts'));

        copyClientFile('page.vue', Path.join(process.cwd(), 'menu', 'page.vue'));
        copyClientFile('home.vue', Path.join(process.cwd(), 'components', 'home', 'layout.vue'));
        copyClientFile('error.vue', Path.join(process.cwd(), 'components', 'error', 'layout.vue'));
        copyClientFile('init.js', Path.join(process.cwd(), 'resources', 'lib', 'init.js'));
    }
    else
    {
        fs.writeFileSync(Path.join(process.cwd(), 'config', 'servers.json'), JSON.stringify({ ui: false }, null, '\t'));
        fs.writeFileSync(Path.join(process.cwd(), 'config', 'servers-production.json'), JSON.stringify({ ui: false }, null, '\t'));
    }

    //-----------------------------

    config.version = '1.0.0';
    config.scripts = {
        start: "core-server",
        test: "core-server --tests"
    };

    config.dependencies = {
        "babel-preset-env": "^1.6.1",
        'bootstrap-notify': "^3.1.3",
        'jquery': "^3.2.1",
        //'raven-js': "^3.15.0",
        'sockjs-client': "^1.1.4",
        'vue-hot-reload-api': "^2.1.0",
        'vue-router': "^2.5.3"
    };

    delete config.ui;
    fs.writeFileSync(Path.join(process.cwd(), 'package.json'), JSON.stringify(config, null, '\t'));

    rl.close();
}

function install()
{
    const { spawn } = require('child_process');
    const ls = spawn('npm', ['install']);

    ls.stdout.on('data', (data) => {
        process.stdout.write(data);
    });

    ls.stderr.on('data', (data) => {
        process.stderr.write(data);
    });

    ls.on('close', (code) => {
        console.log(`Core-Server project created`);
    });
}

module.exports = async function () {

    console.log('Core-Server');
    console.log('----------------------------------------------------------------');
    console.log('This utility will walk you through creating a package.json file.');
    console.log('It only covers the most common items, and tries to guess sensible defaults.\n');
    console.log('See `npm help json` for definitive documentation on these fields\nand exactly what they do.\n');
    console.log('Use `npm install <pkg> --save` afterwards to install a package and\nsave it as a dependency in the package.json file\n');
    console.log('Press ^C at any time to quit.');

    await init();
    install();

    return false;
};
