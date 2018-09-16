import { initApp, initGlobalApp } from '../common/init.js';
import {mergePost} from '../common/init.js';
import api  from './apiManager.js';

const _preloads = {};

function prepareSSRComponent(name, component)
{
    /*component.serverCacheKey = function(props)
    {
        return name + '-' + JSON.stringify(props || {});
    };

    if(component.preload === true)
        _preloads[name] = component.data;*/
}

//-----------------------------------------

/*const app = init({
    onComponent: prepareSSRComponent,
    apiManager: api
});

export let $app = app;*/

const options = {
    onComponent: prepareSSRComponent,
    apiManager: api
};

initGlobalApp(options);

export function createApp() {
    return initApp(options);
}

//-----------------------------------------

export function preloads()
{
    return _preloads;
}

export function transformPost(post, api, manager)
{
    return mergePost(post, api, manager);
}

export default (ctx) => {
    const app = initApp(options);

    api.ctx = ctx;
    app.$router.push(ctx.url);

    return Promise.all( // initialize components
        app.$router.getMatchedComponents().map(c => c.prefetch ? c.prefetch.call(app) : null)
    ).then(() => {
        if(app.$store)
            ctx.state = app.$store.state; // set initial state

        ctx.routeMeta  = app.$route.meta;
        ctx.httpCode   = app.$route.meta.httpCode || 200;
    }).then(() => {
        const metatags = app.$meta();

        ctx.meta = { inject: function () {
            const injected = metatags.inject();
            
            for(var key in injected) {
                if(injected[key].text && key.indexOf('__') === -1)
                    this[key] = injected[key].text();
            }
        }}

        return app;
    });
};
