/**
 * vue-meta v1.3.1
 * (c) 2017 Declan de Wet & Atinux
 * @license MIT
 */
(function (global, factory) {
    typeof exports === 'object' && typeof module !== 'undefined' ? module.exports = factory() :
        typeof define === 'function' && define.amd ? define(factory) :
            (global.VueMeta = factory())
}(this, (function () {
    'use strict'

    /*
object-assign
(c) Sindre Sorhus
@license MIT
*/

    /* eslint-disable no-unused-vars */
    var getOwnPropertySymbols = Object.getOwnPropertySymbols
    var hasOwnProperty = Object.prototype.hasOwnProperty
    var propIsEnumerable = Object.prototype.propertyIsEnumerable

    function toObject(val) {
        if (val === null || val === undefined) {
            throw new TypeError('Object.assign cannot be called with null or undefined')
        }

        return Object(val)
    }

    function shouldUseNative() {
        try {
            if (!Object.assign) {
                return false
            }

            // Detect buggy property enumeration order in older V8 versions.

            // https://bugs.chromium.org/p/v8/issues/detail?id=4118
            var test1 = new String('abc')  // eslint-disable-line no-new-wrappers
            test1[5] = 'de'
            if (Object.getOwnPropertyNames(test1)[0] === '5') {
                return false
            }

            // https://bugs.chromium.org/p/v8/issues/detail?id=3056
            var test2 = {}
            for (var i = 0; i < 10; i++) {
                test2['_' + String.fromCharCode(i)] = i
            }
            var order2 = Object.getOwnPropertyNames(test2).map(function (n) {
                return test2[n]
            })
            if (order2.join('') !== '0123456789') {
                return false
            }

            // https://bugs.chromium.org/p/v8/issues/detail?id=3056
            var test3 = {}
            'abcdefghijklmnopqrst'.split('').forEach(function (letter) {
                test3[letter] = letter
            })
            if (Object.keys(Object.assign({}, test3)).join('') !==
				'abcdefghijklmnopqrst') {
                return false
            }

            return true
        } catch (err) {
            // We don't expect any of the above to throw, but better to be safe.
            return false
        }
    }

    var objectAssign = shouldUseNative() ? Object.assign : function (target, source) {
        var arguments$1 = arguments

        var from
        var to = toObject(target)
        var symbols

        for (var s = 1; s < arguments.length; s++) {
            from = Object(arguments$1[s])

            for (var key in from) {
                if (hasOwnProperty.call(from, key)) {
                    to[key] = from[key]
                }
            }

            if (getOwnPropertySymbols) {
                symbols = getOwnPropertySymbols(from)
                for (var i = 0; i < symbols.length; i++) {
                    if (propIsEnumerable.call(from, symbols[i])) {
                        to[symbols[i]] = from[symbols[i]]
                    }
                }
            }
        }

        return to
    }

    var isMergeableObject = function isMergeableObject(value) {
        return isNonNullObject(value)
		&& !isSpecial(value)
    }

    function isNonNullObject(value) {
        return !!value && typeof value === 'object'
    }

    function isSpecial(value) {
        var stringValue = Object.prototype.toString.call(value)

        return stringValue === '[object RegExp]'
		|| stringValue === '[object Date]'
		|| isReactElement(value)
    }

    // see https://github.com/facebook/react/blob/b5ac963fb791d1298e7f396236383bc955f916c1/src/isomorphic/classic/element/ReactElement.js#L21-L25
    var canUseSymbol = typeof Symbol === 'function' && Symbol.for
    var REACT_ELEMENT_TYPE = canUseSymbol ? Symbol.for('react.element') : 0xeac7

    function isReactElement(value) {
        return value.$$typeof === REACT_ELEMENT_TYPE
    }

    function emptyTarget(val) {
        return Array.isArray(val) ? [] : {}
    }

    function cloneUnlessOtherwiseSpecified(value, optionsArgument) {
        var clone = !optionsArgument || optionsArgument.clone !== false

        return (clone && isMergeableObject(value))
            ? deepmerge(emptyTarget(value), value, optionsArgument)
            : value
    }

    function defaultArrayMerge(target, source, optionsArgument) {
        return target.concat(source).map(function(element) {
            return cloneUnlessOtherwiseSpecified(element, optionsArgument)
        })
    }

    function mergeObject(target, source, optionsArgument) {
        var destination = {}
        if (isMergeableObject(target)) {
            Object.keys(target).forEach(function(key) {
                destination[key] = cloneUnlessOtherwiseSpecified(target[key], optionsArgument)
            })
        }

        Object.keys(source).forEach(function(key) {
            if (!isMergeableObject(source[key]) || !target[key]) {
                destination[key] = cloneUnlessOtherwiseSpecified(source[key], optionsArgument)
            } else {
                destination[key] = deepmerge(target[key], source[key], optionsArgument)
            }
        })
        return destination
    }

    function deepmerge(target, source, optionsArgument) {
        var sourceIsArray = Array.isArray(source)
        var targetIsArray = Array.isArray(target)
        var options = optionsArgument || { arrayMerge: defaultArrayMerge }
        var sourceAndTargetTypesMatch = sourceIsArray === targetIsArray

        if (!sourceAndTargetTypesMatch) {
            return cloneUnlessOtherwiseSpecified(source, optionsArgument)
        } else if (sourceIsArray) {
            var arrayMerge = options.arrayMerge || defaultArrayMerge
            return arrayMerge(target, source, optionsArgument)
        } else {
            return mergeObject(target, source, optionsArgument)
        }
    }

    deepmerge.all = function deepmergeAll(array, optionsArgument) {
        if (!Array.isArray(array)) {
            throw new Error('first argument should be an array')
        }

        return array.reduce(function(prev, next) {
            return deepmerge(prev, next, optionsArgument)
        }, {})
    }

    var deepmerge_1 = deepmerge

    /**
 * lodash (Custom Build) <https://lodash.com/>
 * Build: `lodash modularize exports="npm" -o ./`
 * Copyright jQuery Foundation and other contributors <https://jquery.org/>
 * Released under MIT license <https://lodash.com/license>
 * Based on Underscore.js 1.8.3 <http://underscorejs.org/LICENSE>
 * Copyright Jeremy Ashkenas, DocumentCloud and Investigative Reporters & Editors
 */

    /** `Object#toString` result references. */
    var objectTag = '[object Object]'

    /**
 * Checks if `value` is a host object in IE < 9.
 *
 * @private
 * @param {*} value The value to check.
 * @returns {boolean} Returns `true` if `value` is a host object, else `false`.
 */
    function isHostObject(value) {
        // Many host objects are `Object` objects that can coerce to strings
        // despite having improperly defined `toString` methods.
        var result = false
        if (value != null && typeof value.toString != 'function') {
            try {
                result = !!(value + '')
            } catch (e) {}
        }

        return result
    }

    /**
 * Creates a unary function that invokes `func` with its argument transformed.
 *
 * @private
 * @param {Function} func The function to wrap.
 * @param {Function} transform The argument transform.
 * @returns {Function} Returns the new function.
 */
    function overArg(func, transform) {
        return function(arg) {
            return func(transform(arg))
        }
    }

    /** Used for built-in method references. */
    var funcProto = Function.prototype
    var objectProto = Object.prototype

    /** Used to resolve the decompiled source of functions. */
    var funcToString = funcProto.toString

    /** Used to check objects for own properties. */
    var hasOwnProperty$1 = objectProto.hasOwnProperty

    /** Used to infer the `Object` constructor. */
    var objectCtorString = funcToString.call(Object)

    /**
 * Used to resolve the
 * [`toStringTag`](http://ecma-international.org/ecma-262/7.0/#sec-object.prototype.tostring)
 * of values.
 */
    var objectToString = objectProto.toString

    /** Built-in value references. */
    var getPrototype = overArg(Object.getPrototypeOf, Object)

    /**
 * Checks if `value` is object-like. A value is object-like if it's not `null`
 * and has a `typeof` result of "object".
 *
 * @static
 * @memberOf _
 * @since 4.0.0
 * @category Lang
 * @param {*} value The value to check.
 * @returns {boolean} Returns `true` if `value` is object-like, else `false`.
 * @example
 *
 * _.isObjectLike({});
 * // => true
 *
 * _.isObjectLike([1, 2, 3]);
 * // => true
 *
 * _.isObjectLike(_.noop);
 * // => false
 *
 * _.isObjectLike(null);
 * // => false
 */
    function isObjectLike(value) {
        return !!value && typeof value == 'object'
    }

    /**
 * Checks if `value` is a plain object, that is, an object created by the
 * `Object` constructor or one with a `[[Prototype]]` of `null`.
 *
 * @static
 * @memberOf _
 * @since 0.8.0
 * @category Lang
 * @param {*} value The value to check.
 * @returns {boolean} Returns `true` if `value` is a plain object, else `false`.
 * @example
 *
 * function Foo() {
 *   this.a = 1;
 * }
 *
 * _.isPlainObject(new Foo);
 * // => false
 *
 * _.isPlainObject([1, 2, 3]);
 * // => false
 *
 * _.isPlainObject({ 'x': 0, 'y': 0 });
 * // => true
 *
 * _.isPlainObject(Object.create(null));
 * // => true
 */
    function isPlainObject(value) {
        if (!isObjectLike(value) ||
      objectToString.call(value) != objectTag || isHostObject(value)) {
            return false
        }

        var proto = getPrototype(value)
        if (proto === null) {
            return true
        }

        var Ctor = hasOwnProperty$1.call(proto, 'constructor') && proto.constructor
        return (typeof Ctor == 'function' &&
    Ctor instanceof Ctor && funcToString.call(Ctor) == objectCtorString)
    }

    var lodash_isplainobject = isPlainObject

    /**
 * checks if passed argument is an array
 * @param  {any}  arr - the object to check
 * @return {Boolean} - true if `arr` is an array
 */
    function isArray (arr) {
        return Array.isArray
            ? Array.isArray(arr)
            : Object.prototype.toString.call(arr) === '[object Array]'
    }

    /**
 * Returns the `opts.option` $option value of the given `opts.component`.
 * If methods are encountered, they will be bound to the component context.
 * If `opts.deep` is true, will recursively merge all child component
 * `opts.option` $option values into the returned result.
 *
 * @param  {Object} opts - options
 * @param  {Object} opts.component - Vue component to fetch option data from
 * @param  {String} opts.option - what option to look for
 * @param  {Boolean} opts.deep - look for data in child components as well?
 * @param  {Function} opts.arrayMerge - how should arrays be merged?
 * @param  {Object} [result={}] - result so far
 * @return {Object} result - final aggregated result
 */
    function getComponentOption (opts, result) {
        if ( result === void 0 ) 
            result = {}

        var component = opts.component
        var option = opts.option
        var deep = opts.deep
        var arrayMerge = opts.arrayMerge
        var $options = component.$options

        if (component._inactive) {
            return result 
        }

        // only collect option data if it exists
        if (typeof $options[option] !== 'undefined' && $options[option] !== null) {
            var data = $options[option]

            // if option is a function, replace it with it's result
            if (typeof data === 'function') {
                data = data.call(component)
            }

            if (typeof data === 'object') {
                // merge with existing options
                result = deepmerge_1(result, data, { arrayMerge: arrayMerge })
            } else {
                result = data
            }
        }

        // collect & aggregate child options if deep = true
        if (deep && component.$children.length) {
            component.$children.forEach(function (childComponent) {
                result = getComponentOption({
                    component:  childComponent,
                    option:     option,
                    deep:       deep,
                    arrayMerge: arrayMerge
                }, result)
            })
        }

        return result
    }

    var escapeHTML = function (str) {
        return typeof window === 'undefined'
        // server-side escape sequence
            ? String(str)
                .replace(/&/g, '&amp;')
                .replace(/</g, '&lt;')
                .replace(/>/g, '&gt;')
                .replace(/"/g, '&quot;')
                .replace(/'/g, '&#x27;')
        // client-side escape sequence
            : String(str)
                .replace(/&/g, '\u0026')
                .replace(/</g, '\u003c')
                .replace(/>/g, '\u003e')
                .replace(/"/g, '\u0022')
                .replace(/'/g, '\u0027') 
    }

    function _getMetaInfo (options) {
        if ( options === void 0 ) 
            options = {}

        var keyName = options.keyName
        var tagIDKeyName = options.tagIDKeyName
        /**
   * Returns the correct meta info for the given component
   * (child components will overwrite parent meta info)
   *
   * @param  {Object} component - the Vue instance to get meta info from
   * @return {Object} - returned meta info
   */
        return function getMetaInfo (component) {
            // set some sane defaults
            var defaultInfo = {
                title:                          '',
                titleChunk:                     '',
                titleTemplate:                  '%s',
                htmlAttrs:                      {},
                bodyAttrs:                      {},
                headAttrs:                      {},
                meta:                           [],
                base:                           [],
                link:                           [],
                style:                          [],
                script:                         [],
                noscript:                       [],
                __dangerouslyDisableSanitizers: []
            }

            // collect & aggregate all metaInfo $options
            var info = getComponentOption({
                component:  component,
                option:     keyName,
                deep:       true,
                arrayMerge: function arrayMerge (target, source) {
                    // we concat the arrays without merging objects contained in,
                    // but we check for a `vmid` property on each object in the array
                    // using an O(1) lookup associative array exploit
                    // note the use of "for in" - we are looping through arrays here, not
                    // plain objects
                    var destination = []
                    for (var targetIndex in target) {
                        var targetItem = target[targetIndex]
                        var shared = false
                        for (var sourceIndex in source) {
                            var sourceItem = source[sourceIndex]
                            if (targetItem[tagIDKeyName] && targetItem[tagIDKeyName] === sourceItem[tagIDKeyName]) {
                                shared = true
                                break
                            }
                        }
                        if (!shared) {
                            destination.push(targetItem)
                        }
                    }

                    return destination.concat(source)
                }
            })

            // backup the title chunk in case user wants access to it
            if (info.title) {
                info.titleChunk = info.title
            }

            // replace title with populated template
            if (info.titleTemplate) {
                if (typeof info.titleTemplate === 'function') {
                    info.title = info.titleTemplate.call(component, info.titleChunk)
                } else {
                    info.title = info.titleTemplate.replace(/%s/g, info.titleChunk)
                }
            }

            // convert base tag to an array so it can be handled the same way
            // as the other tags
            if (info.base) {
                info.base = Object.keys(info.base).length ? [info.base] : []
            }

            // sanitizes potentially dangerous characters
            var escape = function (info) {
                return Object.keys(info).reduce(function (escaped, key) {
                    var ref = info.__dangerouslyDisableSanitizers
                    var isDisabled = ref && ref.indexOf(key) > -1
                    var val = info[key]
                    escaped[key] = val
                    if (key === '__dangerouslyDisableSanitizers') {
                        return escaped
                    }

                    if (!isDisabled) {
                        if (typeof val === 'string') {
                            escaped[key] = escapeHTML(val)
                        } else if (lodash_isplainobject(val)) {
                            escaped[key] = escape(val)
                        } else if (isArray(val)) {
                            escaped[key] = val.map(escape)
                        } else {
                            escaped[key] = val
                        }
                    } else {
                        escaped[key] = val
                    }

                    return escaped
                }, {}) 
            }

            // merge with defaults
            info = deepmerge_1(defaultInfo, info)

            // begin sanitization
            info = escape(info)

            return info
        }
    }

    function _titleGenerator (options) {
        if ( options === void 0 ) 
            options = {}

        var attribute = options.attribute

        /**
   * Generates title output for the server
   *
   * @param  {'title'} type - the string "title"
   * @param  {String} data - the title text
   * @return {Object} - the title generator
   */
        return function titleGenerator (type, data) {
            return {
                text: function text () {
                    return ("<" + type + " " + attribute + "=\"true\">" + data + "</" + type + ">")
                }
            }
        }
    }

    function _attrsGenerator (options) {
        if ( options === void 0 ) 
            options = {}

        var attribute = options.attribute

        /**
   * Generates tag attributes for use on the server.
   *
   * @param  {('bodyAttrs'|'htmlAttrs'|'headAttrs')} type - the type of attributes to generate
   * @param  {Object} data - the attributes to generate
   * @return {Object} - the attribute generator
   */
        return function attrsGenerator (type, data) {
            return {
                text: function text () {
                    var attributeStr = ''
                    var watchedAttrs = []
                    for (var attr in data) {
                        if (data.hasOwnProperty(attr)) {
                            watchedAttrs.push(attr)
                            attributeStr += (typeof data[attr] !== 'undefined'
                                ? (attr + "=\"" + (data[attr]) + "\"")
                                : attr) + " "
                        }
                    }
                    attributeStr += attribute + "=\"" + (watchedAttrs.join(',')) + "\""
                    return attributeStr.trim()
                }
            }
        }
    }

    function _tagGenerator (options) {
        if ( options === void 0 ) 
            options = {}

        var attribute = options.attribute

        /**
   * Generates meta, base, link, style, script, noscript tags for use on the server
   *
   * @param  {('meta'|'base'|'link'|'style'|'script'|'noscript')} the name of the tag
   * @param  {(Array<Object>|Object)} tags - an array of tag objects or a single object in case of base
   * @return {Object} - the tag generator
   */
        return function tagGenerator (type, tags) {
            return {
                text: function text (ref) {
                    if ( ref === void 0 ) 
                        ref = {}

                    var body = ref.body; if ( body === void 0 ) 
                        body = false

                    // build a string containing all tags of this type
                    return tags.reduce(function (tagsStr, tag) {
                        if (!!tag.body !== body) {
                            return tagsStr 
                        }

                        // build a string containing all attributes of this tag
                        var attrs = Object.keys(tag).reduce(function (attrsStr, attr) {
                            switch (attr) {
                            // these attributes are treated as children on the tag
                            case 'innerHTML':
                            case 'cssText':
                            case 'once':
                                return attrsStr
                                // these form the attribute list for this tag
                            default:
                                if ([options.tagIDKeyName, 'body'].includes(attr)) {
                                    return (attrsStr + " data-" + attr + "=\"" + (tag[attr]) + "\"")
                                }

                                return typeof tag[attr] === 'undefined'
                                    ? (attrsStr + " " + attr)
                                    : (attrsStr + " " + attr + "=\"" + (tag[attr]) + "\"")
                            }
                        }, '').trim()

                        // grab child content from one of these attributes, if possible
                        var content = tag.innerHTML || tag.cssText || ''

                        // these tag types will have content inserted
                        var closed = ['noscript', 'script', 'style'].indexOf(type) === -1

                        // generate tag exactly without any other redundance attribute
                        var observeTag = tag.once
                            ? ''
                            : (attribute + "=\"true\" ")

                        // the final string for this specific tag
                        return closed
                            ? (tagsStr + "<" + type + " " + observeTag + attrs + "/>")
                            : (tagsStr + "<" + type + " " + observeTag + attrs + ">" + content + "</" + type + ">")
                    }, '')
                }
            }
        }
    }

    function _generateServerInjector (options) {
        if ( options === void 0 ) 
            options = {}

        /**
   * Converts a meta info property to one that can be stringified on the server
   *
   * @param  {String} type - the type of data to convert
   * @param  {(String|Object|Array<Object>)} data - the data value
   * @return {Object} - the new injector
   */
        return function generateServerInjector (type, data) {
            switch (type) {
            case 'title':
                return _titleGenerator(options)(type, data)
            case 'htmlAttrs':
            case 'bodyAttrs':
            case 'headAttrs':
                return _attrsGenerator(options)(type, data)
            default:
                return _tagGenerator(options)(type, data)
            }
        }
    }
                      
    function _inject (options) {
        if ( options === void 0 ) 
            options = {}

        /**
   * Converts the state of the meta info object such that each item
   * can be compiled to a tag string on the server
   *
   * @this {Object} - Vue instance - ideally the root component
   * @return {Object} - server meta info with `toString` methods
   */
        return function inject () {
            // get meta info with sensible defaults
            var info = _getMetaInfo(options)(this.$root)

            // generate server injectors
            for (var key in info) {
                if (info.hasOwnProperty(key) && key !== 'titleTemplate' && key !== 'titleChunk') {
                    info[key] = _generateServerInjector(options)(key, info[key])
                }
            }

            return info
        }
    }

    function _updateTitle () {
        /**
   * updates the document title
   *
   * @param  {String} title - the new title of the document
   */
        return function updateTitle (title) {
            if ( title === void 0 ) 
                title = document.title

            document.title = title
        }
    }

    function _updateTagAttributes (options) {
        if ( options === void 0 ) 
            options = {}

        var attribute = options.attribute

        /**
   * updates the document's html tag attributes
   *
   * @param  {Object} attrs - the new document html attributes
   * @param  {HTMLElement} tag - the HTMLElment tag to update with new attrs
   */
        return function updateTagAttributes (attrs, tag) {
            var vueMetaAttrString = tag.getAttribute(attribute)
            var vueMetaAttrs = vueMetaAttrString ? vueMetaAttrString.split(',') : []
            var toRemove = [].concat(vueMetaAttrs)
            for (var attr in attrs) {
                if (attrs.hasOwnProperty(attr)) {
                    var val = attrs[attr] || ''
                    tag.setAttribute(attr, val)
                    if (vueMetaAttrs.indexOf(attr) === -1) {
                        vueMetaAttrs.push(attr)
                    }

                    var saveIndex = toRemove.indexOf(attr)
                    if (saveIndex !== -1) {
                        toRemove.splice(saveIndex, 1)
                    }
                }
            }
            var i = toRemove.length - 1
            for (; i >= 0; i--) {
                tag.removeAttribute(toRemove[i])
            }
            if (vueMetaAttrs.length === toRemove.length) {
                tag.removeAttribute(attribute)
            } else {
                tag.setAttribute(attribute, vueMetaAttrs.join(','))
            }
        }
    }

    // borrow the slice method
    var toArray = Function.prototype.call.bind(Array.prototype.slice)

    function _updateTags (options) {
        if ( options === void 0 ) 
            options = {}

        var attribute = options.attribute

        /**
   * Updates meta tags inside <head> and <body> on the client. Borrowed from `react-helmet`:
   * https://github.com/nfl/react-helmet/blob/004d448f8de5f823d10f838b02317521180f34da/src/Helmet.js#L195-L245
   *
   * @param  {('meta'|'base'|'link'|'style'|'script'|'noscript')} type - the name of the tag
   * @param  {(Array<Object>|Object)} tags - an array of tag objects or a single object in case of base
   * @return {Object} - a representation of what tags changed
   */
        return function updateTags (type, tags, headTag, bodyTag) {
            var oldHeadTags = toArray(headTag.querySelectorAll((type + "[" + attribute + "]")))
            var oldBodyTags = toArray(bodyTag.querySelectorAll((type + "[" + attribute + "][data-body=\"true\"]")))
            var newTags = []
            var indexToDelete

            if (tags.length > 1) {
                // remove duplicates that could have been found by merging tags
                // which include a mixin with metaInfo and that mixin is used
                // by multiple components on the same page
                var found = []
                tags = tags.map(function (x) {
                    var k = JSON.stringify(x)
                    if (found.indexOf(k) < 0) {
                        found.push(k)
                        return x
                    }
                }).filter(function (x) {
                    return x 
                })
            }

            if (tags && tags.length) {
                tags.forEach(function (tag) {
                    var newElement = document.createElement(type)
                    var oldTags = tag.body !== true ? oldHeadTags : oldBodyTags

                    for (var attr in tag) {
                        if (tag.hasOwnProperty(attr)) {
                            if (attr === 'innerHTML') {
                                newElement.innerHTML = tag.innerHTML
                            } else if (attr === 'cssText') {
                                if (newElement.styleSheet) {
                                    newElement.styleSheet.cssText = tag.cssText
                                } else {
                                    newElement.appendChild(document.createTextNode(tag.cssText))
                                }
                            } else if ([options.tagIDKeyName, 'body'].includes(attr)) {
                                var _attr = "data-" + attr
                                var value = (typeof tag[attr] === 'undefined') ? '' : tag[attr]
                                newElement.setAttribute(_attr, value)
                            } else {
                                var value$1 = (typeof tag[attr] === 'undefined') ? '' : tag[attr]
                                newElement.setAttribute(attr, value$1)
                            }
                        }
                    }

                    newElement.setAttribute(attribute, 'true')

                    // Remove a duplicate tag from domTagstoRemove, so it isn't cleared.
                    if (oldTags.some(function (existingTag, index) {
                        indexToDelete = index
                        return newElement.isEqualNode(existingTag)
                    })) {
                        oldTags.splice(indexToDelete, 1)
                    } else {
                        newTags.push(newElement)
                    }
                })
            }

            var oldTags = oldHeadTags.concat(oldBodyTags)
            oldTags.forEach(function (tag) {
                return tag.parentNode.removeChild(tag) 
            })
            newTags.forEach(function (tag) {
                if (tag.getAttribute('data-body') === 'true') {
                    bodyTag.appendChild(tag)
                } else {
                    headTag.appendChild(tag)
                }
            })

            return { oldTags: oldTags, newTags: newTags }
        }
    }

    function _updateClientMetaInfo (options) {
        if ( options === void 0 ) 
            options = {}

        var ssrAttribute = options.ssrAttribute

        /**
   * Performs client-side updates when new meta info is received
   *
   * @param  {Object} newInfo - the meta info to update to
   */
        return function updateClientMetaInfo (newInfo) {
            var htmlTag = document.getElementsByTagName('html')[0]
            // if this is not a server render, then update
            if (htmlTag.getAttribute(ssrAttribute) === null) {
                // initialize tracked changes
                var addedTags = {}
                var removedTags = {}

                Object.keys(newInfo).forEach(function (key) {
                    switch (key) {
                    // update the title
                    case 'title':
                        _updateTitle(options)(newInfo.title)
                        break
                        // update attributes
                    case 'htmlAttrs':
                        _updateTagAttributes(options)(newInfo[key], htmlTag)
                        break
                    case 'bodyAttrs':
                        _updateTagAttributes(options)(newInfo[key], document.getElementsByTagName('body')[0])
                        break
                    case 'headAttrs':
                        _updateTagAttributes(options)(newInfo[key], document.getElementsByTagName('head')[0])
                        break
                        // ignore these
                    case 'titleChunk':
                    case 'titleTemplate':
                    case 'changed':
                    case '__dangerouslyDisableSanitizers':
                        break
                        // catch-all update tags
                    default:
                        var headTag = document.getElementsByTagName('head')[0]
                        var bodyTag = document.getElementsByTagName('body')[0]
                        var ref = _updateTags(options)(key, newInfo[key], headTag, bodyTag)
                        var oldTags = ref.oldTags
                        var newTags = ref.newTags
                        if (newTags.length) {
                            addedTags[key] = newTags
                            removedTags[key] = oldTags
                        }
                    }
                })

                // emit "event" with new info
                if (typeof newInfo.changed === 'function') {
                    newInfo.changed.call(this, newInfo, addedTags, removedTags)
                }
            } else {
                // remove the server render attribute so we can update on changes
                htmlTag.removeAttribute(ssrAttribute)
            }
        }
    }

    function _refresh (options) {
        if ( options === void 0 ) 
            options = {}

        /**
   * When called, will update the current meta info with new meta info.
   * Useful when updating meta info as the result of an asynchronous
   * action that resolves after the initial render takes place.
   *
   * Credit to [Sébastien Chopin](https://github.com/Atinux) for the suggestion
   * to implement this method.
   *
   * @return {Object} - new meta info
   */
        return function refresh () {
            var info = _getMetaInfo(options)(this.$root)
            _updateClientMetaInfo(options).call(this, info)
            return info
        }
    }

    function _$meta (options) {
        if ( options === void 0 ) 
            options = {}

        /**
   * Returns an injector for server-side rendering.
   * @this {Object} - the Vue instance (a root component)
   * @return {Object} - injector
   */
        return function $meta () {
            return {
                inject:  _inject(options).bind(this),
                refresh: _refresh(options).bind(this)
            }
        }
    }

    // fallback to timers if rAF not present
    var stopUpdate = (typeof window !== 'undefined' ? window.cancelAnimationFrame : null) || clearTimeout
    var startUpdate = (typeof window !== 'undefined' ? window.requestAnimationFrame : null) || (function (cb) {
        return setTimeout(cb, 0) 
    })

    /**
 * Performs a batched update. Uses requestAnimationFrame to prevent
 * calling a function too many times in quick succession.
 * You need to pass it an ID (which can initially be `null`),
 * but be sure to overwrite that ID with the return value of batchUpdate.
 *
 * @param  {(null|Number)} id - the ID of this update
 * @param  {Function} callback - the update to perform
 * @return {Number} id - a new ID
 */
    function batchUpdate (id, callback) {
        stopUpdate(id)
        return startUpdate(function () {
            id = null
            callback()
        })
    }

    /**
 * These are constant variables used throughout the application.
 */

    // This is the name of the component option that contains all the information that
    // gets converted to the various meta tags & attributes for the page.
    var VUE_META_KEY_NAME = 'metaInfo'

    // This is the attribute vue-meta augments on elements to know which it should
    // manage and which it should ignore.
    var VUE_META_ATTRIBUTE = 'data-vue-meta'

    // This is the attribute that goes on the `html` tag to inform `vue-meta`
    // that the server has already generated the meta tags for the initial render.
    var VUE_META_SERVER_RENDERED_ATTRIBUTE = 'data-vue-meta-server-rendered'

    // This is the property that tells vue-meta to overwrite (instead of append)
    // an item in a tag list. For example, if you have two `meta` tag list items
    // that both have `vmid` of "description", then vue-meta will overwrite the
    // shallowest one with the deepest one.
    var VUE_META_TAG_LIST_ID_KEY_NAME = 'vmid'

    // automatic install
    if (typeof Vue !== 'undefined') {
        Vue.use(VueMeta)
    }

    /**
 * Plugin install function.
 * @param {Function} Vue - the Vue constructor.
 */
    function VueMeta (Vue, options) {
        if ( options === void 0 ) 
            options = {}

        // set some default options
        var defaultOptions = {
            keyName:      VUE_META_KEY_NAME,
            attribute:    VUE_META_ATTRIBUTE,
            ssrAttribute: VUE_META_SERVER_RENDERED_ATTRIBUTE,
            tagIDKeyName: VUE_META_TAG_LIST_ID_KEY_NAME
        }
        // combine options
        options = objectAssign(defaultOptions, options)

        // bind the $meta method to this component instance
        Vue.prototype.$meta = _$meta(options)

        // store an id to keep track of DOM updates
        var batchID = null

        // watch for client side component updates
        Vue.mixin({
            beforeCreate: function beforeCreate () {
                // Add a marker to know if it uses metaInfo
                if (typeof this.$options[options.keyName] !== 'undefined') {
                    this._hasMetaInfo = true
                }

                // coerce function-style metaInfo to a computed prop so we can observe
                // it on creation
                if (typeof this.$options[options.keyName] === 'function') {
                    if (typeof this.$options.computed === 'undefined') {
                        this.$options.computed = {}
                    }

                    this.$options.computed.$metaInfo = this.$options[options.keyName]
                }
            },
            created: function created () {
                var this$1 = this

                // if computed $metaInfo exists, watch it for updates & trigger a refresh
                // when it changes (i.e. automatically handle async actions that affect metaInfo)
                // credit for this suggestion goes to [Sébastien Chopin](https://github.com/Atinux)
                if (this.$metaInfo) {
                    this.$watch('$metaInfo', function () {
                        // batch potential DOM updates to prevent extraneous re-rendering
                        batchID = batchUpdate(batchID, function () {
                            return this$1.$meta().refresh() 
                        })
                    })
                }
            },
            activated: function activated () {
                var this$1 = this

                if (this._hasMetaInfo) {
                    // batch potential DOM updates to prevent extraneous re-rendering
                    batchID = batchUpdate(batchID, function () {
                        return this$1.$meta().refresh() 
                    })
                }
            },
            deactivated: function deactivated () {
                var this$1 = this

                if (this._hasMetaInfo) {
                    // batch potential DOM updates to prevent extraneous re-rendering
                    batchID = batchUpdate(batchID, function () {
                        return this$1.$meta().refresh() 
                    })
                }
            },
            beforeMount: function beforeMount () {
                var this$1 = this

                // batch potential DOM updates to prevent extraneous re-rendering
                if (this._hasMetaInfo) {
                    batchID = batchUpdate(batchID, function () {
                        return this$1.$meta().refresh() 
                    })
                }
            },
            destroyed: function destroyed () {
                var this$1 = this

                // do not trigger refresh on the server side
                if (this.$isServer) {
                    return 
                }

                // re-render meta data when returning from a child component to parent
                if (this._hasMetaInfo) {
                    // Wait that element is hidden before refreshing meta tags (to support animations)
                    var interval = setInterval(function () {
                        if (this$1.$el.offsetParent !== null) {
                            return 
                        }

                        clearInterval(interval)
                        batchID = batchUpdate(batchID, function () {
                            return this$1.$meta().refresh() 
                        })
                    }, 50)
                }
            }
        })
    }

    var version = "1.3.1"

    VueMeta.version = version

    VueMeta.serverInjector = _generateServerInjector({
        attribute: 'data-vue-meta',
    
        // keyName: VUE_META_KEY_NAME,
        ssrAttribute: 'data-vue-meta-server-rendered',
    // tagIDKeyName: VUE_META_TAG_LIST_ID_KEY_NAME
    })
    return VueMeta

})))
