const Path  = require('path');
const cluster = require('cluster');
const sane  = require('sane');

class Watcher
{
    constructor()
    {
        this.timeout = null;

        this.siteChangeListeners = [];
        this.fileChangeListeners = {};

        if (cluster.isMaster || process.env.NODE_ENV === 'production')
            return;

        const _this = this;
        function changeDetected()
        {
            _this.changeDetected.apply(_this, arguments);
        }

        var useWatchman = false;
        try {
            const spawn = require("child_process").spawnSync('watchman');
            if(!spawn.error)
                useWatchman = true;
        } catch(e) { }

        var sWatch  = sane(process.cwd(), { dot: false, watchman: useWatchman });
        sWatch.on('change', changeDetected);
        sWatch.on('add', changeDetected);
        sWatch.on('delete', changeDetected);
    }

    clearTimeout()
    {
        try
        {
            if (this.timeout != null)
                clearTimeout(this.timeout);
        }
        catch (e)
        {
            console.error(e);
        }

        this.timeout = null;
    }

    setTimeout()
    {
        const _this = this;
        this.timeout = setTimeout(function()
        {
            console.warn('Thread restarting');
            process.send('restartWorker');
        }, 200);
    }

    onChange(dir, callback)
    {
        this.siteChangeListeners.push({
            dir: Path.normalize(dir),
            callback: callback
        });
    }

    onFileChange(file, callback)
    {
        file = Path.normalize(file);
        if (this.fileChangeListeners[file] === undefined)
            this.fileChangeListeners[file] = [];

        this.fileChangeListeners[file].push(callback);
    }

    emitFileChanged(file)
    {
        if (this.fileChangeListeners[file] !== undefined)
        {
            try
            {
                var listeners = this.fileChangeListeners[file];
                for (var key in listeners)
                {
                    try
                    {
                        listeners[key](file);
                    }
                    catch (e)
                    {
                        console.error(e);
                    }
                }
            }
            catch (e)
            {
                console.error(e);
            }
        }
    }

    executeCallback(obj, relativePath, fullPath)
    {
        try
        {
            if (relativePath.substr(0, obj.dir.length) === obj.dir)

                obj.callback(fullPath, relativePath);
        }
        catch (e)
        {
            console.error(e);
        }
    }

    emitSiteChanged(relativePath, fullPath)
    {
        try
        {
            const listeners = this.siteChangeListeners;
            for (var key in listeners)

                this.executeCallback(listeners[key], relativePath, fullPath);
        }
        catch (e)
        {
            console.error(e);
        }

        this.emitFileChanged(relativePath);
        this.emitFileChanged(Path.normalize(fullPath));
    }

    onCoreChanged(filepath)
    {
        this.clearTimeout();
        this.setTimeout();
    }

    changeDetected(filepath, root)
    {
        if (Path.normalize(root) === Path.join(__dirname, '..', '..'))
        {
            if ((filepath.substr(0, 8) === 'modules' + Path.sep && Path.extname(filepath) != '.php') || filepath === 'server.js')
                return this.onCoreChanged(filepath);
        }

        if (Path.normalize(root) === Path.normalize(process.cwd()))
        {
            if (filepath.substr(0, 5) === 'core' + Path.sep)
                this.onCoreChanged(filepath);
            else
                this.emitSiteChanged(filepath, Path.join(root, filepath));
        }
    }
}

module.exports = new Watcher();