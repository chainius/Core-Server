import BaseManager from '../common/apiManager.js';
import formPoster  from './formPoster';
import { mergePost } from '../common/init.js';
import ApiMerger     from '../common/merger.js';

const SockJS = require('sockjs-client');

class ApiManager extends BaseManager
{
    constructor()
    {
        super();
        this.isClient   = true;
        this.formPoster = formPoster;
        this.socketConnected = false;

        if (!this.token)
            this.generateToken();
        else if (this.token.length != 28)
            this.generateToken();
        else
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
                        const post     = _this.mergePost(this.api_data);
                        const api_salt = _this.getSalt(this.api, post);

                        if(window.API_DATA[api_salt])
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
                this.socket.close();
            } catch (e) {
                console.error(e);
            }
        }

        var _this = this;
        this.socket = new SockJS(this.base() + 'socketapi?token=' + this.token);
        this.socket.onopen = function () {
            this.socketConnected = true;
            _this.emitSocketOpen();
        };
        this.socket.onmessage = function (e) {
            _this.emitSocketMessage(e);
        };
        this.socket.onclose = function () {
            this.socketConnected = false;
            _this.emitSocketClose();
        };
    }

    base()
    {
        if (this.base_url)
            return this.base_url;

        var base = location.href;
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

        return unescape(dc.substr(begin, end - begin));
    }

    setCookies(cookies, expiration) {
        var expires = '';
        if (expiration) {
            var d = new Date();
            d.setTime(expiration);
            expires = "expires=" + d.toUTCString() + ';';
        }

        for (var key in cookies) {
            document.cookie = key + "=" + cookies[key] + ";" + expires + "path=/";

            if (key === 'token') {
                this.token = cookies[key];
                this.socketConnect();
            }
        }
    }

    deleteOldCache() {
        try {
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
            if (typeof (localStorage) == "object" && localStorage !== undefined && localStorage !== null) {
                localStorage.removeItem(this.token + '_' + api_salt);
            }
        } catch (e) {
            console.error(e);
        }
    }

    saveLocalCache(api_salt, data) {
        try {
            if (typeof (localStorage) == "object" && localStorage !== undefined && localStorage !== null) {
                localStorage.setItem(this.token + '_' + api_salt, JSON.stringify(data));
            }
        } catch (e) {
            console.error(e);
        }
    }

    getLocalCache(api_salt) {
        try {
            if (typeof (localStorage) == "object") {
                var localObject = localStorage.getItem(this.token + '_' + api_salt);
                try {
                    localObject = JSON.parse(localObject);

                    if(localObject === null && window.API_DATA[api_salt])
                    {
                        localObject = window.API_DATA[api_salt];
                    }

                    return localObject;
                } catch (e) {}
            }
        } catch (e) {
            console.error(e);
        }

        return window.API_DATA[api_salt] || null;
    }

    //---------------------------------------------------------

    emitSocketOpen() {
        this.socketIsOpen = true;

        for (var key in this.onOpenCallbacks) {
            try {
                this.onOpenCallbacks[key].call(this, this);
            } catch (e) {
                console.error(e);
            }
        }
    }

    emitSocketClose() {
        if (this.isDev)
            console.warn('Socket closed');

        this.socket = false;
        this.fetchingApis = [];
        this.socketConnect();
    }

    emitSocketMessage(msg) {
        try {
            if (msg.type === 'message') {
                var data = msg.data;

                try {
                    data = JSON.parse(data);

                    if (data.api) {
                        this.emitApi(data.api, data.data, data.salt);
                    } else if (data.apiError) {
                        this.handleApiError(data.apiError, data.error, data.salt);
                    } else if (data.cookies) {
                        this.setCookies(data.cookies, data.expiration);
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

    emitApi(api, data, salt) {
        this.saveLocalCache(salt, data);
        var found = false;

        if (salt === undefined) {
            salt = this.getSalt(api, mergePost({}));
        }

        for (var key in this.onApiCallbacks) {
            try {

                const post = mergePost(JSON.parse(JSON.stringify(this.onApiCallbacks[key].post)));

                if (this.getSalt(this.onApiCallbacks[key].api, post) === salt)
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

        if (this.socketIsOpen === false) {
            return this.onSocketOpen(function () {
                this.socket.send(msg);
            });
        }

        this.socket.send(msg);
        return this;
    }

    onSocketOpen(cb) {
        if (this.socketIsOpen) {
            try {
                cb();
            } catch (e) {
                console.error(e);
            }
        } else {
            this.onOpenCallbacks.push(cb);
        }

        return this;
    }

    //---------------------------------------------------------

    require(api, data, cb)
    {
        const res = super.require(api, data, cb);

        if(!res)
            return;

        this.sendSocketMessage({
            api: api,
            data: res.data,
            salt: res.salt
        });

        return res.id;
    }

    refresh(api, data)
    {
        const res = super.refresh(api, data);

        if(!res)
            return;

        this.sendSocketMessage({
            api: api,
            data: res.data,
            salt: res.salt
        });
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

if (ApiManager.shared === undefined)
    ApiManager.shared = new ApiManager();

export default ApiManager.shared;