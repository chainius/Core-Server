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
        this.formPoster.handleAccessDenied = this.onAccessDenied.bind(this);

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

    deleteOldCache() {
        try {
            if(location.href.indexOf('file://') === 0)
                return;

            if (typeof (sessionStorage) == "object") {
                for (var i = sessionStorage.length - 1; i >= 0; i--) {
                    var key = sessionStorage.key(i);
                    var index = key.indexOf('_');

                    if (key.substr(0, index) !== this.token) {
                        sessionStorage.removeItem(key);
                    }
                }
            }
        } catch (e) {
            console.error(e);
        }
    }

    deleteAllCache() {
        return this.$storage.deleteAllCache()
    }

    deleteLocalCache(api_salt, data) {
        try {
            if(location.href.indexOf('file://') === 0)
                return;

            if (typeof (sessionStorage) == "object" && sessionStorage !== undefined && sessionStorage !== null) {
                sessionStorage.removeItem(this.token + '_' + api_salt);
            }
        } catch (e) {
            console.error(e);
        }
    }

    saveLocalCache(api_salt, data) {
        return this.$storage.putCache(this.token + '_' + api_salt, data);
    }

    getLocalCache(api_salt) {
        const cache = this.$storage.getCache(this.token + '_' + api_salt);
        if(cache !== null)
            return cache;

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