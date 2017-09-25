import BaseManager from '../common/apiManager.js';

class ApiManager extends BaseManager
{
    constructor()
    {
        super();
        this.isClient = false;

        const _this = this;
        Vue.mixin({
            created() //SSR
            {
                if(this.api && this.$options.preload)
                {
                    try {
                        _this.bindVue(this, this.api, this.api_data);
                    } catch (e) {
                        console.error(e);
                    }
                }
            }
        });
    }

    //---------------------------------------------------------

    getCookie(name)
    {
        return '';
    }

    setCookies(cookies, expiration)
    {

    }

    deleteOldCache()
    {

    }

    deleteAllCache()
    {

    }

    deleteLocalCache(api_salt, data)
    {

    }

    saveLocalCache(api_salt, data)
    {

    }

    getLocalCache(api_salt)
    {
        return null;
    }

    //---------------------------------------------------------

    require(api, data, cb)
    {
        const xr  = super.require(api, data, cb);

        if(!xr || !this.ctx)
            return;

        const res = this.ctx.api(api, xr.data);

        if(res)
            cb(res);

        return xr.id;
    }

    post(api, data)
    {
        return new Promise(function (resolve, reject) {
            resolve([]);
        });
    }
}

if (ApiManager.shared === undefined)
    ApiManager.shared = new ApiManager();

export default ApiManager.shared;