import BaseManager   from '../common/apiManager.js';
import ApiMerger     from '../common/merger.js';

const SockJS = require('sockjs-client');

class ApiManager extends BaseManager
{
    constructor()
    {
        super();
        this.isClient   = true;
        this.formPoster = __FormPosterReqPath;
        this.socketConnected = false;
        this.saltApiForcers  = {};
        
        if(this.formPoster.default)
            this.formPoster = this.formPoster.default;
        
        this.formPoster.$api = this;

        if (!this.token)
            this.generateToken();
        else if (this.token.length < 10 || this.token.length > 20)
            this.generateToken();

        this.socketConnect();
        this.deleteOldCache();

        const _this = this;

        Vue.mixin({
            created()
            {
                try
                {
                    if(this.$options.preload && this.api)
                    {
                        const post     = _this.mergePost(this.api_data, this.api);
                        const api_salt = _this.getSalt(this.api, post);

                        if(window.API_DATA && window.API_DATA[api_salt])
                        {
                            ApiMerger(this, window.API_DATA[api_salt]);
                        }
                    }

                    if(this.api)
                    {
                        _this.bindVue(this, this.api, this.api_data);
                    }
                }
                catch(e)
                {
                    console.error(e);
                }
            }

        });
    }

    socketConnect()
    {
        if (!this.isClient)
            return null;

        if (this.socket) {
            try {
                console.warn('Closing old socket');
                this.socket.close();
            } catch (e) {
                console.error(e);
            }
        }

        var _this = this;
        const socket = new SockJS(this.base() + 'socketapi?token=' + this.token);
        this.socket = socket
        this.socket.onopen = function () {
            _this.socket = socket
            _this.socketConnected = true;
            _this.emitSocketOpen();
        };
        this.socket.onmessage = function (e) {
            _this.socketConnected = true;
            _this.emitSocketMessage(e);
        };
        this.socket.onclose = function () {
            _this.socketConnected = false;
            _this.emitSocketClose();
        };
    }

    base()
    {
        if (this.base_url)
            return this.base_url;

        var base = window.api_url || location.href;
        var index = base.indexOf('//');

        if (index != -1) {
            index = base.indexOf('/', index + 3);
            if (index != -1) {
                this.base_url = base.substr(0, index + 1);
                return this.base_url;
            }
        }

        return '';
    }

    //---------------------------------------------------------

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

        if (end == -1)
            return dc.substr(begin);

        var res = String(dc.substr(begin, end - begin));
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
            }
            const btoa = (window.btoa || function (str) { return str; });
            document.cookie = key + "=" + `enc:${btoa(this.hexEncode(cookies[key]))}` + ";" + expires + "path=/";

            if (key === 'token') {
                this.token = cookies[key];

                if(this.socket)
                    this.socket.close();
            }
        }
    }

    deleteOldCache() {
        try {
            if(location.href.indexOf('file://') === 0)
                return;

            if (typeof (localStorage) == "object") {
                for (var i = localStorage.length - 1; i >= 0; i--) {
                    var key = localStorage.key(i);
                    var index = key.indexOf('_');

                    if (key.substr(0, index) !== this.token) {
                        localStorage.removeItem(key);
                    }
                }
            }
        } catch (e) {
            console.error(e);
        }
    }

    deleteAllCache() {
        try {
            if(location.href.indexOf('file://') === 0)
                return;

            if (typeof (localStorage) == "object") {
                for (var i = localStorage.length - 1; i >= 0; i--) {
                    var key = localStorage.key(i);
                    localStorage.removeItem(key);
                }
            }
        } catch (e) {
            console.error(e);
        }
    }

    deleteLocalCache(api_salt, data) {
        try {
            if(location.href.indexOf('file://') === 0)
                return;

            if (typeof (localStorage) == "object" && localStorage !== undefined && localStorage !== null) {
                localStorage.removeItem(this.token + '_' + api_salt);
            }
        } catch (e) {
            console.error(e);
        }
    }

    saveLocalCache(api_salt, data) {
        try {
            if(location.href.indexOf('file://') === 0)
                return;

            if (typeof (localStorage) == "object" && localStorage !== undefined && localStorage !== null) {
                localStorage.setItem(this.token + '_' + api_salt, JSON.stringify(data));
            }
        } catch (e) {
            if(e.code === 22) {
                console.warn('Cache quota exceeded, purging cache.');
                this.deleteAllCache();
                return;
            }

            console.error(e);
        }
    }

    getLocalCache(api_salt) {
        try {
            if(location.href.indexOf('file://') === 0)
                return;

            if (typeof (localStorage) == "object") {
                var localObject = localStorage.getItem(this.token + '_' + api_salt);
                try {
                    localObject = JSON.parse(localObject);

                    if(localObject === null && window.API_DATA && window.API_DATA[api_salt])
                    {
                        localObject = window.API_DATA[api_salt];
                    }

                    return localObject;
                } catch (e) {}
            }
        } catch (e) {
            console.error(e);
        }
        
        if(!window.API_DATA)
            return null;

        return window.API_DATA[api_salt] || null;
    }

    //---------------------------------------------------------

    emitSocketOpen() {
        const callbacks      = this.onOpenCallbacks;
        this.onOpenCallbacks = [];

        for (var key in callbacks) {
            try {
                callbacks[key].call(this, this);
            } catch (e) {
                console.error(e);
            }
        }

        var count = 0;
        for(var key in this.saltApiForcers) {
            count ++;
            this.saltApiForcers[key]();
        }
    }

    emitSocketClose() {
        if (this.isDev)
            console.warn('Socket closed');

        this.socketConnected = false;
        this.socket = false;
        this.fetchingApis = [];
        
        setTimeout(() => {
            console.log('Socket closed, reconnecting')
            this.socketConnect();
        }, 500);
    }

    emitSocketMessage(msg) {
        try {
            if (msg.type === 'message') {
                var data = msg.data;

                try {
                    if(typeof(data) !== 'object')
                        data = JSON.parse(data);

                    if (data.api) {
                        this.emitApi(data.api, data.data, data.salt);
                    } else if (data.apiError) {
                        this.handleApiError(data.apiError, data.error, data.salt);
                    } else if (data.cookies) {
                        this.setCookies(data.cookies, data.expiration);
                    } else if (data.error) {
                        console.error(data)
                    }
                } catch (e) {
                    console.error(e);
                }

                for (var key in this.socketHooks) {
                    try {
                        this.socketHooks[key](data);
                    } catch (e) {
                        console.error(e);
                    }
                }
            }
        } catch (e) {
            console.error(e);
        }
    }

    verifyCallbackSalt(inputSalt, inputApi, callback) {
        if(!inputSalt)
            return callback.api === inputApi;

        const post = this.mergePost(JSON.parse(JSON.stringify(callback.post)), callback.api);
        return this.getSalt(callback.api, post) === inputSalt;
    }

    emitApi(api, data, salt) {
        this.saveLocalCache(salt, data);
        var found = false;

        if (salt === undefined) {
            //salt = this.getSalt(api, this.mergePost({}, api));
            this.clearLiveStorage(api);
        }

        if(this.saltApiForcers[salt])
            delete this.saltApiForcers[salt];

        for (var key in this.onApiCallbacks) {
            try {

                //const post = this.mergePost(JSON.parse(JSON.stringify(this.onApiCallbacks[key].post)), api);
                //if (salt === undefined || this.getSalt(this.onApiCallbacks[key].api, post) === salt)

                if(this.verifyCallbackSalt(salt, api, this.onApiCallbacks[key]))
                {
                    found = true;
                    this.onApiCallbacks[key].callback.call(this, data, api, this.onApiCallbacks[key].id);
                }
            } catch (e)
            {
                console.error(e);
            }
        }

        if (!found && this.isDev)
            console.warn('Api handler not found for', api, salt);
    }

    sendSocketMessage(msg) {
        if (!this.isClient)
            return null;

        if (typeof (msg) === 'object' || typeof (msg) === 'array') {
            try {
                msg = JSON.stringify(msg);
            } catch (e) {
                console.error(e);
            }
        }

        if (this.socketConnected === false) {
            return this.onSocketOpen(function () {
                this.socket.send(msg);
            });
        }


        this.socket.send(msg);
        return this;
    }

    onSocketOpen(cb) {
        if (this.socketConnected) {
            try {
                cb.call(this);
            } catch (e) {
                console.error(e);
            }
        } else {
            this.onOpenCallbacks.push(cb);
        }

        return this;
    }

    //---------------------------------------------------------

    clearLiveStorage(api) {
        try {
            this.fetchingApis = this.fetchingApis.filter((o) => o.salt.split('_')[0] !== api);

            if (typeof (localStorage) == "object") {
                for (var i = localStorage.length - 1; i >= 0; i--) {
                    var key = localStorage.key(i).split('_');

                    if (key[0] === this.token && key[1] === api) {
                        localStorage.removeItem(key.join('_'));
                    }
                }
            }
        } catch (e) {
            console.error(e);
        }
    }

    //---------------------------------------------------------

    sendApiAndForceResponse(api, data, salt) {
        const _this = this;

        this.saltApiForcers[salt] = function() {
            _this.sendSocketMessage({
                api:  api,
                data: data,
                salt: salt
            });
        }

        if(!this.socketConnected)
            return;

        this.saltApiForcers[salt]();
    }

    require(api, data, cb, onError)
    {
        const res = super.require(api, data, cb, onError);

        if(!res)
            return;

        this.sendApiAndForceResponse(api, res.data, res.salt);

        return res.id;
    }

    refresh(api, data)
    {
        const res = super.refresh(api, data);

        if(!res)
            return;

        this.sendApiAndForceResponse(api, res.data, res.salt);
    }

    post(api, data)
    {
        const _this = this;
        const res   = super.post(api, data);

        if(!res)
            return;

        return new Promise(function (resolve, reject) {
            _this.onApiCallbacks.push({
                id: res.id,
                api: api,
                post: res.data,
                //salt: salt,
                callback: function (res) {
                    _this.unbindListener(res.id);
                    resolve(res);
                },
                errorCallback: function(res) {
                    _this.unbindListener(res.id);
                    reject(res);
                }
            });

            _this.sendSocketMessage({
                api: api,
                data: res.data,
                salt: res.salt
            });
        });
    }
}

if(InitReq.ApiManager)
    ApiManager = InitReq.ApiManager(ApiManager)

if (ApiManager.shared === undefined)
    ApiManager.shared = new ApiManager();

export default ApiManager.shared;