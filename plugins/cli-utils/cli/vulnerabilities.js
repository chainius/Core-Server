const nsp   = require('nsp');
const Table = require('cli-table');
const Path  = require('path');

process.on('uncaughtException', function (err) {
    console.warn('Exception caught: ', arguments);
    console.warn(err.stack);
    process.exit(1);
});

var utils = require('retire/lib/utils'),
    program = require('commander'),
    retire = require('retire/lib/retire'),
    repo = require('retire/lib/repo'),
    resolve = require('retire/lib/resolve'),
    scanner = require('retire/lib/scanner'),
    forward = require('retire/lib/utils').forwardEvent,
    os = require('os'),
    path = require('path'),
    fs = require('fs'),
    emitter = new require('events').EventEmitter;

var table = new Table({
    head: ['Name', 'Description', 'Score', "Installed", "Patched", "More Info"],
    colWidths: [20, 50, 20, 20, 20, 50]
});

//-------------------------------------------------------------------------------------------------------------------

function logVulnerability(vuln) {
    table.push([vuln.module || '', vuln.title || '', vuln.cvss_score || '', vuln.version || '', vuln.patched_versions || '', vuln.advisory || '']);
}

function retireScan(path) {
    return new Promise(function (resolveIntern, reject) {
        var events = new emitter();
        var jsRepo = null;
        var nodeRepo = null;
        var vulnsFound = false;
        var finalResults = [];

        var config = utils.extend({
            path: path
        }, utils.pick(program, [
          'package', 'node', 'js', 'jspath', 'verbose', 'nodepath', 'path', 'jsrepo', 'noderepo',
          'dropexternal', 'nocache', 'proxy', 'ignore', 'ignorefile', 'outputformat', 'outputpath', 'exitwith',
          'includemeta'
        ]));
        var scanStart = Date.now();

        config.nocache = true;
        //config.cachedir = path.resolve(os.tmpdir(), '.retire-cache/');
        config.ignore = {
            paths: [],
            descriptors: []
        };

        scanner.on('vulnerable-dependency-found', function (results) {
            vulnsFound = true;
            finalResults.push(results);
        });

        scanner.on('dependency-found', function (results) {
            if (config.verbose) finalResults.push(results);
        });

        events.on('js-repo-loaded', function () {
            //Load node repo
            repo.loadrepository('https://raw.githubusercontent.com/RetireJS/retire.js/master/repository/npmrepository.json', config).on('done', function (repo) {
                nodeRepo = repo;
                events.emit('node-repo-loaded');
                events.emit('scan-js');
            }).on('stop', forward(events, 'stop'));
        });

        events.on('scan-js', function () {
            resolve.scanJsFiles(config.path)
                .on('jsfile', function (file) {
                    scanner.scanJsFile(file, jsRepo, config);
                })
                .on('bowerfile', function (bowerfile) {
                    scanner.scanBowerFile(bowerfile, jsRepo, config);
                })
                .on('end', function () {
                    events.emit('js-scanned');
                    events.emit('scan-node');
                });
        });

        events.on('scan-node', function () {
            resolve.getNodeDependencies(config.path, config.package).on('done', function (dependencies) {
                scanner.scanDependencies(dependencies, nodeRepo, config);
                events.emit('scan-done');
            });
        });

        events.on('scan-done', function () {
            var exit = function (exitCode) {
                exitCode = exitCode || 0;
                process.exit(vulnsFound ? (config.exitwith || 13) : exitCode);
            };

            var xresults = {};

            for (var key in finalResults)
            {
                const res = finalResults[key];

                for (var x in res.results)
                {
                    const res2 = res.results[x];
                    xresults[ res2.component ] = {
                        module: res2.component,
                        title:  'test',
                        cvss_score: 'test',
                        version: res2.component.version,
                        patched_versions: '',
                        advisory: ''
                    };

                    for(var y in res2.vulnerabilities)
                    {
                        const vuln = res2.vulnerabilities[y];

                        logVulnerability({
                            module: res2.component,
                            title:  vuln.identifiers ? vuln.identifiers.summary : '',
                            cvss_score: vuln.severity,
                            version: res2.version,
                            patched_versions: '',
                            advisory: vuln.info.join("\n")
                        });
                    }
                }
            }

            resolveIntern();
        });

        events.on('stop', function () {
            console.warn('Error:', arguments);
            process.exit(1);
        });


        repo.loadrepository('https://raw.githubusercontent.com/RetireJS/retire.js/master/repository/jsrepository.json', config).on('done', function (repo) {
            jsRepo = repo;
            events.emit('js-repo-loaded');
        }).on('stop', forward(events, 'stop'));
    });
}

function nspScan(path) {
    return new Promise(function (resolve, reject) {
        nsp.check({
            package: Path.join(path, 'package.json')
        }, function (err, result) {
            if (err)
                reject(err);

            for (var key in result)
                logVulnerability(result[key]);

            resolve();
        });
    });
}

async function startScan() {
    try {
        await retireScan(process.cwd());
        await nspScan(process.cwd());

        if (table.length > 0) {
            if (table.length === 1)
                console.success("Vuln", "1 vulnerability found");
            else
                console.success("Vuln", table.length, "vulnerabilities found");

            console.log(table.toString());
        } else {
            console.success("Vuln", "no vulnerabilities found");
        }
    } catch (e) {
        console.error('Vuln', e);
    }
}

module.exports = async function () {
    console.info('Vuln', 'Scanning for vulnerabilities, please wait..');
    await startScan();
    return false;
}
