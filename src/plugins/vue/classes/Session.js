const RenderCache = plugins.require('vue/RenderCache');

class Session extends SuperClass {

    getComponentsCache()
    {
        if(!this.componentsCache)
        {
            this.componentsCache = new RenderCache(this);
        }

        return this.componentsCache;
    }

}

module.exports = Session;