var compile$1 = require('lodash.template')
var compileOptions = {
    escape:      /{{([^{][\s\S]+?[^}])}}/g,
    interpolate: /{{{([\s\S]+?)}}}/g
}

var path = require('path')
var serialize = require('serialize-javascript')

class TemplateRenderer {

    constructor(options) {
        this.options = options
        this.inject = options.inject !== false
        // if no template option is provided, the renderer is created
        // as a utility object for rendering assets like preload links and scripts.
        this.parsedTemplate = options.template ? this.parseTemplate(options.template) : null

        // extra functionality with client manifest
        if (options.clientManifest) {
            var clientManifest = this.clientManifest = options.clientManifest
            this.publicPath = clientManifest.publicPath.replace(/\/$/, '')
            // preload/prefetch directives
            this.preloadFiles = (clientManifest.initial || []).map(normalizeFile)
            this.prefetchFiles = (clientManifest.async || []).map(normalizeFile)
            // initial async chunk mapping
            this.mapFiles = createMapper(clientManifest)
        }
    }

    bindRenderFns(context) {
        var renderer = this;
        
        ['ResourceHints', 'State', 'Scripts', 'Styles'].forEach(function (type) {
            context[("render" + type)] = renderer[("render" + type)].bind(renderer, context)
        })
        // also expose getPreloadFiles, useful for HTTP/2 push
        context.getPreloadFiles = renderer.getPreloadFiles.bind(renderer, context)
    }
    
    // render synchronously given rendered app content and render context
    renderSync(content, context) {
        var template = this.parsedTemplate
        if (!template) {
            throw new Error('renderSync cannot be called without a template.')
        }
        
        context = context || {}
        if (this.inject) {
            return (
                template.head(context) +
                (context.head || '') +
                this.renderResourceHints(context) +
                this.renderStyles(context) +
                template.neck(context) +
                content +
                this.renderState(context) +
                this.renderScripts(context) +
                template.tail(context)
            )
        } else {
            return (
                template.head(context) +
                template.neck(context) +
                content +
                template.tail(context)
            )
        }
    }
    
    renderStyles(context) {
        var this$1 = this

        var cssFiles = this.clientManifest
            ? this.clientManifest.all.filter(isCSS)
            : []
        return (
            // render links for css files
            (cssFiles.length
                ? cssFiles.map(function (file) {
                    return ("<link rel=\"stylesheet\" href=\"" + (this$1.publicPath) + "/" + file + "\">") 
                }).join('')
                : '') +
            // context.styles is a getter exposed by vue-style-loader which contains
            // the inline component styles collected during SSR
            (context.styles || '')
        )
    }
    
    renderResourceHints(context) {
        return this.renderPreloadLinks(context) + this.renderPrefetchLinks(context)
    }
    
    getPreloadFiles(context) {
        var usedAsyncFiles = this.getUsedAsyncFiles(context)
        if (this.preloadFiles || usedAsyncFiles) {
            return (this.preloadFiles || []).concat(usedAsyncFiles || [])
        } else {
            return []
        }
    }
    
    renderPreloadLinks(context) {
        var this$1 = this

        var files = this.getPreloadFiles(context)
        var shouldPreload = this.options.shouldPreload
        if (files.length) {
            return files.map(function (ref) {
                var file = ref.file
                var extension = ref.extension
                var fileWithoutQuery = ref.fileWithoutQuery
                var asType = ref.asType

                var extra = ''
                // by default, we only preload scripts or css
                if (!shouldPreload && asType !== 'script' && asType !== 'style') {
                    return ''
                }

                // user wants to explicitly control what to preload
                if (shouldPreload && !shouldPreload(fileWithoutQuery, asType)) {
                    return ''
                }

                if (asType === 'font') {
                    extra = " type=\"font/" + extension + "\" crossorigin"
                }

                return ("<link rel=\"preload\" href=\"" + (this$1.publicPath) + "/" + file + "\"" + (asType !== '' ? (" as=\"" + asType + "\"") : '') + extra + ">")
            }).join('')
        } else {
            return ''
        }
    }
    
    renderPrefetchLinks(context) {
        var this$1 = this

        var shouldPrefetch = this.options.shouldPrefetch
        if (this.prefetchFiles) {
            var usedAsyncFiles = this.getUsedAsyncFiles(context)
            var alreadyRendered = function (file) {
                return usedAsyncFiles && usedAsyncFiles.some(function (f) {
                    return f.file === file 
                })
            }
            return this.prefetchFiles.map(function (ref) {
                var file = ref.file
                var fileWithoutQuery = ref.fileWithoutQuery
                var asType = ref.asType

                if (shouldPrefetch && !shouldPrefetch(fileWithoutQuery, asType)) {
                    return ''
                }

                if (alreadyRendered(file)) {
                    return ''
                }

                return ("<link rel=\"prefetch\" href=\"" + (this$1.publicPath) + "/" + file + "\">")
            }).join('')
        } else {
            return ''
        }
    }
    
    renderState(context, options) {
        var ref = options || {}
        var contextKey = ref.contextKey; if ( contextKey === void 0 ) 
            contextKey = 'state'

        var windowKey = ref.windowKey; if ( windowKey === void 0 ) 
            windowKey = '__INITIAL_STATE__'

        var autoRemove = process.env.NODE_ENV === 'production'
            ? ';(function(){var s;(s=document.currentScript||document.scripts[document.scripts.length-1]).parentNode.removeChild(s);}());'
            : ''
        return context[contextKey]
            ? ("<script>window." + windowKey + "=" + (serialize(context[contextKey], { isJSON: true })) + autoRemove + "</script>")
            : ''
    }
    
    renderScripts(context) {
        var this$1 = this

        if (this.clientManifest) {
            var initial = this.preloadFiles
            var async = this.getUsedAsyncFiles(context)
            var needed = [initial[0]].concat(async || [], initial.slice(1))
            return needed.filter(function (ref) {
                var file = ref.file

                return isJS(file)
            }).map(function (ref) {
                var file = ref.file

                return ("<script src=\"" + (this$1.publicPath) + "/" + file + "\" defer></script>")
            }).join('')
        } else {
            return ''
        }
    }
    
    getUsedAsyncFiles(context) {
        if (!context._mappedFiles && context._registeredComponents && this.mapFiles) {
            var registered = Array.from(context._registeredComponents)
            context._mappedFiles = this.mapFiles(registered).map(normalizeFile)
        }

        return context._mappedFiles
    }
    
    // create a transform stream
    createStream(context) {
        if (!this.parsedTemplate) {
            throw new Error('createStream cannot be called without a template.')
        }

        return new TemplateStream(this, this.parsedTemplate, context || {})
    }
    
    //-------------------------------
    
    parseTemplate(template, contentPlaceholder) {
        if ( contentPlaceholder === void 0 )
            contentPlaceholder = '<!--vue-ssr-outlet-->'

        if (typeof template === 'object')
            return template

        var i = template.indexOf('</head>')
        var j = template.indexOf(contentPlaceholder)

        if (j < 0)
            throw new Error("Content placeholder not found in template.")

        if (i < 0) {
            i = template.indexOf('<body>')
            if (i < 0)
                i = j
        }

        return {
            head: compile$1(template.slice(0, i), compileOptions),
            neck: compile$1(template.slice(i, j), compileOptions),
            tail: compile$1(template.slice(j + contentPlaceholder.length), compileOptions)
        }
    }
}

function normalizeFile (file) {
    var withoutQuery = file.replace(/\?.*/, '')
    var extension = path.extname(withoutQuery).slice(1)
    return {
        file:             file,
        extension:        extension,
        fileWithoutQuery: withoutQuery,
        asType:           getPreloadType(extension)
    }
}

function getPreloadType (ext) {
    if (ext === 'js') {
        return 'script'
    } else if (ext === 'css') {
        return 'style'
    } else if (/jpe?g|png|svg|gif|webp|ico/.test(ext)) {
        return 'image'
    } else if (/woff2?|ttf|otf|eot/.test(ext)) {
        return 'font'
    } else {
    // not exhausting all possibilities here, but above covers common cases
        return ''
    }
}

module.exports = TemplateRenderer