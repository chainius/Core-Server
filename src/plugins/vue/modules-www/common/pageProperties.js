export default function serializeProperites(component)
{
    const props = {};

    function addProps(p)
    {
        for(var key in p)
            props[key] = p[key];
    }

    function addMixin(mixin)
    {
        for(var key in mixin)
        {
            if(key === 'mixins')
            {
                const mixins = mixin[key];
                for(var x in mixins)
                {
                    addMixin(mixins[x]);
                }
            }
            else if(key === 'props')
            {
                addProps(mixin[key]);
            }
        }
    }

    addMixin(component);

    const routes  = [];
    var mandatory = true;
    var path = '';

    for(var key in props)
    {
        if(typeof(key) !== 'string')
        {
            path += '/:' + props[key];
        }
        else
        {
            if(props[key].default)
                routes.push(path);

            path += '/:' + key;
        }
    }

    if(routes.length === 0 && path === '')
        return routes;

    routes.push(path);
    return routes;
}