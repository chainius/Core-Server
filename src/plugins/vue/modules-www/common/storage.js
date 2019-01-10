class StorageManager {

    constructor() {
        this.dbStore = {};
        this.dbCache = {};
    }

    install(Vue, options) {
        Vue.prototype.$storage = this;
    }

    get isClient() {
        if(this._isClient === undefined)
            this._isClient = (typeof(window) !== "undefined");

        return this._isClient;
    }

    //-----

    hexEncode(str) {
        var hex, i;
    
        var result = "";
        for (i=0; i<str.length; i++) {
            hex = str.charCodeAt(i).toString(16);
            result += ("000"+hex).slice(-4);
        }
        return result
    }

    hexDecode(str) {
        var j;
        var hexes = str.match(/.{1,4}/g) || [];
        var back = "";
        for(j = 0; j<hexes.length; j++) {
            back += String.fromCharCode(parseInt(hexes[j], 16));
        }
        return back;
    }

    getCookie(name) {
        if(!this.isClient)
            return '';

        var dc = document.cookie;
        var prefix = name + "=";

        var begin = dc.indexOf("; " + prefix);
        var beginLength = 2 + prefix.length;

        if (begin == -1) {
            begin = dc.indexOf(";" + prefix);
            beginLength--;

            if (begin == -1 && dc.indexOf(prefix) == 0) {
                begin = 0;
                beginLength--;
            } else {
                return '';
            }
        }

        begin += beginLength;
        const end = dc.indexOf(';', begin);
        var res = (end === -1) ? dc.substr(begin) : dc.substr(begin, end - begin);
        if (res.substr(0, 4) === 'enc:') {
            res = res.substr(4, res.length);
            const atob = (window.atob || function (str) { return str; });
            res = this.hexDecode(atob(res));
        }
        res = unescape(res);

        return res;
    }

    setCookies(cookies, expiration) {
        var expires = '';
        if (expiration) {
            var d = new Date();
            d.setTime(expiration);
            expires = "expires=" + d.toUTCString() + ';';
        }

        for (var key in cookies) {
            if (typeof cookies[key] !== 'string') {
                cookies[key] = JSON.stringify(cookies[key]);
                const btoa = (window.btoa || function (str) { return str; });
                document.cookie = key + "=" + `enc:${btoa(this.hexEncode(cookies[key]))}` + ";" + expires + "path=/";
            } else {
                document.cookie = key + "=" + cookies[key] + ";" + expires + "path=/";
            }
        }
    }

    //-----

    put(key, val) {
        try {
            this.dbStore[key] = val;

            if(!this.isClient || location.href.indexOf('file://') === 0)
                return null;

            if (typeof (localStorage) == "object" && localStorage !== undefined && localStorage !== null)
                localStorage.setItem(key, JSON.stringify(val));
            else
                this.setCookies({ key: val }, Date.now() * 2)
        } catch (e) {
            if(e.code === 22) {
                return console.warn('Cache quota exceeded, purging cache.');
            }

            console.error(e);
        }
    }

    get(key) {
        if(this.dbStore[key])
            return this.dbStore[key];

        if(!this.isClient)
            return null;

        try {
            if(location.href.indexOf('file://') === 0)
                return;

            if (typeof (localStorage) == "object" && localStorage !== undefined && localStorage !== null) {
                var localObject = localStorage.getItem(key);
                try {
                    return JSON.parse(localObject);
                } catch (e) {}

                return localObject;
            } else {
                return this.getCookie(key);
            }
        } catch (e) {
            console.error(e);
        }

        return null;
    }

    //-----

    deleteAllCache() {
        try {
            if(location.href.indexOf('file://') === 0)
                return;

            if (typeof(sessionStorage) == "object") {
                for (var i = sessionStorage.length - 1; i >= 0; i--) {
                    var key = sessionStorage.key(i);
                    sessionStorage.removeItem(key);
                }
            }
        } catch (e) {
            console.error(e);
        }
    }

    putCache(key, val) {
        try {
            this.dbCache[key] = val;

            if(!this.isClient || location.href.indexOf('file://') === 0)
                return null;

            if (typeof(sessionStorage) == "object" && sessionStorage !== undefined && sessionStorage !== null)
                sessionStorage.setItem(key, JSON.stringify(val));
        } catch (e) {
            if(e.code === 22) {
                this.deleteAllCache();
                return console.warn('Session cache quota exceeded, purging cache.');
            }

            console.error(e);
        }
    }

    getCache(key, val) {
        if(this.dbCache[key])
            return this.dbCache[key];

        if(!this.isClient)
            return null;

        try {
            if(location.href.indexOf('file://') === 0)
                return;

            if (typeof (sessionStorage) == "object" && sessionStorage !== undefined && sessionStorage !== null) {
                var localObject = sessionStorage.getItem(key);
                try {
                    return JSON.parse(localObject);
                } catch (e) {}

                return localObject;
            }
        } catch (e) {
            console.error(e);
        }

        return null;
    }
}

export default new StorageManager()