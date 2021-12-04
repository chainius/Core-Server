const GitStats = require("git-stats")
const child = require('child_process')
const Path = require('path')
const Table = require('cli-table')

function spawnLog(cmd) {
    child.exec(cmd, { cwd: process.cwd() }, function(error, stdout, stderr) {
        if (error) {
            console.error(error)
            return
        }

        console.log(stdout)
    })
}

function exec(cmd, arg) {
    return child.execSync(cmd, { cwd: process.cwd() }).toString()
}

function onlyUnique(value, index, self) {
    return self.indexOf(value) === index
}

function getAuthorStats(name) {
    const statsTable = exec("git log --author=\""+name+"\" --since=2016-01-01 --pretty=tformat: --numstat").split("\n")
    const stats = []
    var adds = 0
    var removes = 0
    var extensions = []

    for(var key in statsTable) {
        statsTable[key] = statsTable[key].split("\t")
        const statsKey = statsTable[key]

        if(statsKey.length < 3)
            continue

        if(statsKey[2].indexOf("}") !== -1)
            statsKey[2] = statsKey[2].substr(0, statsKey[2].indexOf("}"))

        if(statsKey[2].indexOf("?") !== -1)
            statsKey[2] = statsKey[2].substr(0, statsKey[2].indexOf("?"))

        const ext = Path.extname(statsKey[2])
        if(['', '.png', '.jpg', '.gif', '.eot', '.svg', '.ttf', '.woff', '.woff2', '.log', '.pem', '.crt', '.csr', '.otf', '.txt'].indexOf(ext) !== -1)
            continue

        const add = parseInt(statsKey[0])
        if (!isNaN(add))
            adds += add

        const rm = parseInt(statsKey[1])
        if (!isNaN(rm))
            removes += rm

        extensions.push(ext)
    }

    extensions = extensions.filter(onlyUnique)
    return {
        author:     name,
        adds:       adds,
        removes:    removes,
        total:      adds-removes,
        extensions: extensions.join('\n')
    }
}

function getAuthors() {
    return exec("git log --format='%aN' | sort -u").split("\n")
}

function getAuthorCommits() {
    const result = []
    const authors = getAuthors()

    for(var key in authors) {
        if(authors[key] !== "")
            result.push( getAuthorStats(authors[key]) )
    }

    return result
}

module.exports = function(gitShow) {
    const g1 = new GitStats()

    if (!gitShow || gitShow === 'calendar') {
        g1.ansiCalendar({
            theme: "LIGHT"
        }, function (err, data) {
            console.log(err || data)
        })
    }

    if (!gitShow || gitShow === 'authors') {
        g1.authorsPie({
            repo:   process.cwd(),
            start:  '2016-01-01',
            end:    '2020-01-01',
            radius: 10
        }, function (err, data) {
            console.log(err || data)
        })

        //----------------------------------------

        const table = new Table({
            head:      ['Name', 'New lines', 'Deleted lines', "Total lines", "Extensions"],
            colWidths: [50, 30, 30, 30, 50]
        })

        const subStats = getAuthorCommits()
        for(var key in subStats)
            table.push([subStats[key].author, subStats[key].adds, subStats[key].removes, subStats[key].total, subStats[key].extensions])

        console.log(table.toString())
    }

    if(gitShow === 'authors-list') {
        console.log(getAuthors().join("\n"))
    }

    return false
}