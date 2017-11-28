import init from '../common/init.js';
import {mergePost} from '../common/init.js';
import api  from './apiManager.js';

const _preloads = {};

function prepareSSRComponent(name, component)
{
    component.serverCacheKey = function(props)
    {
        return JSON.stringify(props || {});
    };

    if(component.preload === true)
        _preloads[name] = component.data;
}

//-----------------------------------------

const app = init({
    onComponent: prepareSSRComponent,
    apiManager: api
});

export function createApp() {
    return init({
        onComponent() {},
        apiManager: api
    });
}

//-----------------------------------------

export function preloads()
{
    return _preloads;
}

export function transformPost(post)
{
    return mergePost(post);
}

export default (ctx) => {
    api.ctx = ctx;
    app.$router.push(ctx.url);

    return Promise.all( // initialize components
        app.$router.getMatchedComponents().map(c => c.prefetch ? c.prefetch.call(app) : null)
    ).then(() => {
        if(app.$store)
            ctx.state = app.$store.state; // set initial state

        ctx.meta  = app.$route.meta;
    }).then(() => {
        const metatags = app.$meta();
        ctx.metatags = metatags;
        return app;
    });
};
