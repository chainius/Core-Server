//import store from './store';
import app from '../../menu/backoffice.vue';

const bulk = require('bulk-require');
const vue_templates = bulk(__dirname + "/../../components/", ['**/*.vue']);

export function initComponents( register )
{
    var folder          = null;

    for(var x in vue_templates)
    {
        if(typeof(vue_templates[x]) === 'object')
        {
            folder = vue_templates[x];

            for(var key in folder)
            {
                var name = (x + "-" + key).replace('/', '-');
                register(name, folder[key]);
            }
        }
    }
}
/*
export function getRavenKey()
{
    return '...';
}
*/
export function getApp()
{
    /*return Vue.util.extend({
        store: store
    }, app);*/

    return app;
}

export function getDefaultPost()
{
    return { }
}

export function setupEnvironment( apiManager, isClient )
{
    //...
}