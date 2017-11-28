const TemplateRenderer = require('./TemplateRenderer.js');
const { makeMap, extend }      = require('./utils.js');

const build = require('../build.js')

const createRenderFunction = build.createRenderFunction;
const createWriteFunction = build.createWriteFunction;
const RenderContext = build.RenderContext;
const renderNode = build.renderNode;
const installSSRHelpers = build.installSSRHelpers;
const normalizeRender = build.normalizeRender;
const isUndef        = build.isUndef;

/*  */

var isUnaryTag = makeMap(
  'area,base,br,col,embed,frame,hr,img,input,isindex,keygen,' +
  'link,meta,param,source,track,wbr'
);

// Elements that you can, intentionally, leave open
// (and which close themselves)
var canBeLeftOpenTag = makeMap(
  'colgroup,dd,dt,li,options,p,td,tfoot,th,thead,tr,source'
);

// HTML5 tags https://html.spec.whatwg.org/multipage/indices.html#elements-3
// Phrasing Content https://html.spec.whatwg.org/multipage/dom.html#phrasing-content
var isNonPhrasingTag = makeMap(
  'address,article,aside,base,blockquote,body,caption,col,colgroup,dd,' +
  'details,dialog,div,dl,dt,fieldset,figcaption,figure,footer,form,' +
  'h1,h2,h3,h4,h5,h6,head,header,hgroup,hr,html,legend,li,menuitem,meta,' +
  'optgroup,option,param,rp,rt,source,style,summary,tbody,td,tfoot,th,thead,' +
  'title,tr,track'
);

/*  */


function show (node, dir) {
  if (!dir.value) {
    var style = node.data.style || (node.data.style = {});
    style.display = 'none';
  }
}

// this is only applied for <select v-model> because it is the only edge case
// that must be done at runtime instead of compile time.
function model (node, dir) {
  if (!node.children) { return }
  var value = dir.value;
  var isMultiple = node.data.attrs && node.data.attrs.multiple;
  for (var i = 0, l = node.children.length; i < l; i++) {
    var option = node.children[i];
    if (option.tag === 'option') {
      if (isMultiple) {
        var selected =
          Array.isArray(value) &&
          (looseIndexOf(value, getValue(option)) > -1);
        if (selected) {
          setSelected(option);
        }
      } else {
        if (looseEqual(value, getValue(option))) {
          setSelected(option);
          return
        }
      }
    }
  }
}

function getValue (option) {
  var data = option.data || {};
  return (
    (data.attrs && data.attrs.value) ||
    (data.domProps && data.domProps.value) ||
    (option.children && option.children[0] && option.children[0].text)
  )
}

function setSelected (option) {
  var data = option.data || (option.data = {});
  var attrs = data.attrs || (data.attrs = {});
  attrs.selected = '';
}

var baseDirectives = {
  show: show,
  model: model
};

/*  */

const gen = require('../meta.js').serverInjector;


class Renderer {

    constructor(options) {
        if (options === void 0) options = {};

        options = extend(extend({}, options), {
            isUnaryTag: isUnaryTag,
            canBeLeftOpenTag: canBeLeftOpenTag,
            modules: [
                build.renderAttrs,
                build.renderDOMProps,
                build.renderClass,
                build.renderStyle
            ],
            // user can provide server-side implementations for custom directives
            // when creating the renderer.
            directives: extend(baseDirectives, options.directives)
        });

        this.template   = options.template;
        this.modules    = options.modules || [];
        this.directives = options.directives || {};
        this.cache      = options.cache;
        this.isUnaryTag = options.isUnaryTag || (function() { return false });
        
        if (this.cache && (!this.cache.get || !this.cache.set))
            throw new Error('renderer cache must implement at least get & set.')

        this.get  = this.get.bind(this);
        this.has  = this.has.bind(this);
        this.next = this.next.bind(this);

        //------------------------

        this.templateRenderer = new TemplateRenderer({
            template:           this.template,
            inject:             options.inject,
            shouldPreload:      options.shouldPreload,
            shouldPrefetch:     options.shouldPrefetch,
            clientManifest:     options.clientManifest
        });

    }

    renderToString(component, context, cb) {
        if (typeof context === 'function') {
            cb = context;
            context = {};
        }
        if (context) {
            this.templateRenderer.bindRenderFns(context);
        }

        var result = '';
        var write = createWriteFunction(function (text) {
            result += text;
            return false
        }, cb);

        const _this = this;
        try {
            const template = this.template;
            const templateRenderer = this.templateRenderer;

            this.render(component, write, context, function () {
                if (template) {
                    const info = _this.meta;
                    context.meta = {}

                    for (let key in info) {
                        if (info.hasOwnProperty(key) && key !== 'titleTemplate' && key !== 'titleChunk') {
                            context.meta[key] = gen(key, info[key]);
                            
                            if(context.meta[key].text)
                                context.meta[key] = context.meta[key].text()
                        }
                    }

                    result = templateRenderer.renderSync(result, context);
                }
                cb(null, result);
            });
        } catch (e) {
            cb(e);
        }
    }

    renderToStream(component, context)  {
        if (context) {
            templateRenderer.bindRenderFns(context);
        }
        var renderStream = new RenderStream(function (write, done) {
            render(component, write, context, done);
        });
        if (!template) {
            return renderStream
        } else {
            var templateStream = templateRenderer.createStream(context);
            renderStream.on('error', function (err) {
                templateStream.emit('error', err);
            });
            renderStream.pipe(templateStream);
            return templateStream
        }
    }
    
    //----------------------------------------------

    render(component, write, userContext, done) {
        build.warned = Object.create(null);

        this.userContext    = userContext;
        this.activeInstance = component;
        this.renderStates   = [];

        this.write          = write;
        this.done           = done;
        this.renderNode     = renderNode;

        this.meta = {
            title: '',
            titleChunk: '',
            titleTemplate: '%s',
            htmlAttrs: {},
            bodyAttrs: {},
            headAttrs: {},
            meta: [],
            base: [],
            link: [],
            style: [],
            script: [],
            noscript: [],
            __dangerouslyDisableSanitizers: []
        };

        installSSRHelpers(component);
        normalizeRender(component);
        renderNode(component._render(), true, this);
    }
    
    get(key, cb) {
        return this.cache.get.call(this.cache, key, cb);
    }
    
    has(key, cb) {
        return this.cache.has.call(this.cache, key, cb);
    }

    next() {
        var lastState = this.renderStates[this.renderStates.length - 1];
        if (isUndef(lastState)) {
            return this.done()
        }

        switch (lastState.type) {
            case 'Element':
                var children = lastState.children;
                var total    = lastState.total;
                var rendered = lastState.rendered++;
                if (rendered < total) {
                    this.renderNode(children[rendered], false, this);
                } else {
                    this.renderStates.pop();
                    this.write(lastState.endTag, this.next);
                }
                break
            case 'Component':
                this.renderStates.pop();
                this.activeInstance = lastState.prevActive;
                this.next();
                break
            case 'ComponentWithCache':
                this.renderStates.pop();
                var buffer = lastState.buffer;
                var bufferIndex = lastState.bufferIndex;
                var componentBuffer = lastState.componentBuffer;
                var key = lastState.key;
                var result = {
                    html: buffer[bufferIndex],
                    components: componentBuffer[bufferIndex]
                };
                this.cache.set(key, result);
                if (bufferIndex === 0) {
                    // this is a top-level cached component,
                    // exit caching mode.
                    this.write.caching = false;
                } else {
                    // parent component is also being cached,
                    // merge self into parent's result
                    buffer[bufferIndex - 1] += result.html;
                    var prev = componentBuffer[bufferIndex - 1];
                    result.components.forEach(function (c) {
                        return prev.add(c);
                    });
                }
                buffer.length = bufferIndex;
                componentBuffer.length = bufferIndex;
                this.next();
                break
        }
    }

}

module.exports = Renderer;
