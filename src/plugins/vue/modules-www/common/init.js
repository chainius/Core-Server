import Router from 'vue-router';
import Meta from 'vue-meta';
import serializeProperties from './pageProperties';

var options  = {};
var errorComponent = null;
const routes = [];

Vue.use(Router);
Vue.use(Meta);

//------------------------------------------------------------------

function registerComponent(name, component)
{
    if(options.onComponent)
        options.onComponent(name, component);
    
    var componentRoutes = [];

    if(name.substr(name.length-7) === '-layout')
    {
        const meta = {};

        if(component.permissions)
            meta.permissions = component.permissions;
        if(component.permissionsRedirect)
            meta.permissionsRedirect = component.permissionsRedirect;

        var page = name.substr(0, name.length-7);
        name = 'page-'+page;

        const config = {
            path: '/' + page,
            component: Vue.component('page-'+page, component),
            meta: meta
        };

        if(page === 'error' || page === '404')
            errorComponent = config.component;
        else if(page === 'home' && errorComponent === null)
            errorComponent = config.component;

        if(page === 'home')
            config.path = '/';

        const ser = serializeProperties(component);

        if(ser.length === 0)
        {
            routes.push(config);
            componentRoutes.push(config);
        }

        for(var key in ser)
        {
            const r = {
                path: '/' + page + ser[key],
                component: config.component,
                meta: meta,
                props: true
            };

            componentRoutes.push(r);
            routes.push(r);
        }
    }
    else
    {
        if(name.substr(0, 6) === 'tools-')
            name = name.substr(6);

        Vue.component(name, component);
    }
    
    return {
        routes: componentRoutes
    }
}

function checkRoutePermission(to, from, next) {

    if (process.env.VUE_ENV !== 'client' || !to.meta)
        return next();

    const manager = options.apiManager.permissionsManager;
    if (!manager)
        return next();

    if(!manager.layoutAuthorized( to.meta ))
        return next({ path: manager.layoutRedirectPath( to.meta ) });

    next();
}

export function mergePost(post)
{
    if(InitReq.getDefaultPost)
    {
        const npost = InitReq.getDefaultPost();

        for(var key in npost)
        {
            if(post[key] === undefined)
                post[key] = npost[key];
        }
    }

    return post;
}

export default function initApp( _options )
{
    InitReq.setupEnvironment( _options.apiManager, _options.apiManager.isClient );

    options = _options || {};
    InitReq.initComponents( registerComponent );

    if(errorComponent !== null)
        routes.push({ path: '*', component: errorComponent, meta: { httpCode: 404 } });

    const router = new Router({
        mode: 'history',
        abstract: true,
        scrollBehavior: function(to, from, savedPosition) {
            if (to.hash) {
                return {selector: to.hash}
            } else {
                return { x: 0, y: 0 }
            }
        },
        routes
    });

    router.beforeEach(checkRoutePermission);

    const app   = InitReq.getApp(router, _options.apiManager.isClient);
    Vue.use(options.apiManager);

    return new Vue(
        Vue.util.extend({
            //i18n,
            router: router,
            api: options.apiManager
        }, app)
    );
}