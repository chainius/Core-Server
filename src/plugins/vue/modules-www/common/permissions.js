/**
* Directive: v-permissions "abc,test,test"
* layout: { permissions: 'abc,test', permissionsRedirect: optional path, data: .., methods: .. }
*/
class PermissionsManager
{
    constructor(apiManager)
    {
        this.permissions = [];
        this.defaultRedirect = '/';
        this.bindedElements = [];
        this.api = apiManager;

        this.loadCache();

        //---------------------------
        //Setup directive

        const directive = {};
        const _this = this;
        function bindHook(name, dest)
        {
            const methodName = 'directive' + name.charAt(0).toUpperCase() + name.slice(1);
            directive[name] = function()
            {
                if(_this[methodName])
                    _this[methodName].apply(_this, arguments);
            };
        }

        bindHook('bind');
        bindHook('inserted');
        bindHook('update');
        bindHook('componentUpdated');
        bindHook('unbind');

        Vue.directive('permission', directive);
        Vue.directive('permissions', directive);
    }

    normalizePermissions(permissions)
    {
        if(typeof(permissions) === 'string')
            permissions = permissions.split(',');

        for(var key in permissions)
            permissions[key] = permissions[key].split(' ').join('');

        return permissions;
    }

    directiveInserted( el, permissions )
    {
        this.directiveUpdate( el, permissions );
    }

    directiveBind( el, permissions )
    {
        this.bindedElements.push({
            el: el,
            permissions: permissions
        });
    }

    directiveUnbind( el )
    {
        for(var key in this.bindedElements)
        {
            if(this.bindedElements[key].el === el)
            {
                this.bindedElements.splice(key, 1);
                this.directiveUnbind(el);
                break;
            }
        }
    }

    directiveUpdate( el, permissions )
    {
        try
        {
            if(!el.style)
                return;

            for(var key in this.bindedElements)
            {
                if(this.bindedElements[key].el === el)
                {
                    this.bindedElements[key].permissions = permissions;
                }
            }

            permissions = permissions.value;

            if(this.hasPermission(permissions))
                el.style.display = '';
            else
                el.style.display = 'none';
        }
        catch(e)
        {
            console.error(e);
        }
    }

    directiveComponentUpdated()
    {
        //console.log('component udpated', arugments);
    }

    //----------------------------

    loadCache()
    {
        const cache = this.api.getLocalCache('user_permissions');

        if(cache !== null && ['array', 'object'].indexOf(typeof(cache)) !== -1)
        {
            this.permissions = cache;
        }
    }

    hasPermission(permissions)
    {
        const nPermissions = this.normalizePermissions(permissions);

        for(var key in nPermissions)
        {
            var not = false;
            var perm = nPermissions[key];

            if(perm.substr(0, 1) === '!')
            {
                not  = true;
                perm = perm.substr(1);
            }

            if(perm === 'connected')
            {
                if(!not && this.connected())
                    return true;
                if(not && !this.connected())
                    return true;
            }
            else if(this.permissions.indexOf(perm) !== -1)
            {
                return !not;
            }
        }

        return false;
    }

    setPermissions(permissions)
    {
        if(typeof(permissions) === 'string')
            permissions = [permissions];

        this.permissions = permissions;
        this.api.saveLocalCache('user_permissions', permissions);

        for(var key in this.bindedElements)
        {
            this.directiveUpdate( this.bindedElements[key].el, this.bindedElements[key].permissions );
        }
    }

    //----------------------------

    layoutAuthorized(layout)
    {
        if(!layout.permissions)
            return true;

        return this.hasPermission( layout.permissions );
    }

    layoutRedirectPath(layout)
    {
        if(layout.permissionsRedirect)
            return layout.permissionsRedirect;

        return this.defaultRedirect;
    }

    connected()
    {
        return this.permissions.length > 0;
    }
}

module.exports = PermissionsManager;