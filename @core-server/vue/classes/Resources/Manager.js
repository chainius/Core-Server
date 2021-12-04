class ResourcesManager extends SuperClass {

    purgeCache() {
        super.purgeCache()
        this.siteManager.pagesCache = {}
    }
    
}

module.exports = ResourcesManager