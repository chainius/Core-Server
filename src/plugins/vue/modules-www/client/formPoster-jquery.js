window.$ = require('jquery');
require('bootstrap-notify');

$.fn.serializeObject = function()
{
    var o = {};
    var a = this.serializeArray();
    $.each(a, function() {
        if (o[this.name] !== undefined) {
            if (!o[this.name].push) {
                o[this.name] = [o[this.name]];
            }
            o[this.name].push(this.value || '');
        } else {
            o[this.name] = this.value || '';
        }
    });
    return o;
};

class FormPoster
{
    constructor()
    {
        const _this = this;
        this.events = {
            'api-progress': this.handleApiProgress,
            'api-prepare':  this.handleApiPrepare,
            'api-error':    this.handleApiError,
            'api-success':  this.handleApiSuccess,
            'api-done':     this.handleApiDone
        };

        $(document).off('submit', 'form');
        $(document).on('submit', 'form', function(e)
        {
            if(!$(this).attr('action'))
                return;

            e.preventDefault();
            _this.handleFormSubmit(this);
        });
    }

    handleApiError(form, data)
    {
        var msg = "An error occured while processing your request";
        const err = data.error;

        if(typeof(err) == 'object' || typeof(err) == "array")
        {
            if(typeof(err.error) == 'string')
                msg = err.error;
        }
        else if(typeof(err) == "string")
            msg = err;

        $.notify({ message: msg },{ type: 'danger' });
    }

    handleApiSuccess(form, data)
    {
        const that= $(form);
        const msg = data.result;

        if(that.attr('SuccessMessage'))
           return $.notify(that.attr('SuccessMessage'), 'success');

        if(typeof(msg) === 'string')
            return $.notify(msg, 'success');

        if(typeof(msg) === 'object')
        {
            if(typeof(msg.result) === 'string')
                return $.notify(msg.result, 'success');
        }
    }

    handleApiPrepare(form, data)
    {
        $(form).find('input, textarea, select, button').not(':disabled').attr('disabled', true).attr('predisabled', true);

        //ToDo: set loader icon
    }

    handleApiProgress(form, data)
    {
        //ToDo set progress in button
    }

    handleApiDone(form)
    {
        $(form).find('[predisabled]').removeAttr('disabled').removeAttr('predisabled');
    }

    trigger(elm, eventName, data)
    {
        try
        {
            const secondName = eventName.replace(/-\S*/g, function(txt){ return txt.charAt(1).toUpperCase() + txt.substr(2).toLowerCase();});

            if(secondName !== eventName)
            {
                if(!this.trigger(elm, secondName, data))
                    return;
            }

            //------------------------------------------------------------------------

            var event; // The custom event that will be created

            if (document.createEvent) {
                event = document.createEvent("HTMLEvents");
                event.initEvent(eventName, true, true);
            } else {
                event = document.createEventObject();
                event.eventType = eventName;
            }

            event.eventName = eventName;

            for(var key in data)
                event[key] = data[key];

            if (document.createEvent)
                elm.dispatchEvent(event);
            else
                elm.fireEvent("on" + event.eventType, event);

            if(event.defaultPrevented)
                return false;
        }
        catch(e)
        {
            console.error(e);
        }

        try
        {
            if(this.events[eventName])
                this.events[eventName].call(this, elm, data);
        }
        catch(e)
        {
            console.error(e);
        }

        return true;
    }
    
    urlEncode(obj) {
        var str = [];
        for (var p in obj)
        if (obj.hasOwnProperty(p)) {
          str.push(encodeURIComponent(p) + "=" + encodeURIComponent(obj[p]));
        }
        return str.join("&");
    }


    handleFormSubmit(elm)
    {
        const _this    = this;
        const api      = $(elm).attr('action');
        const method   = ($(elm).attr('method') || 'POST').toUpperCase();
        var that       = $(elm);
        var data       = null;

        //that.trigger('api-before-submit', elm);
        _this.trigger(elm, 'api-before-submit', { api: api });
        
        $.event.global.ajaxError = false;
        var path = api.indexOf('://') === -1 && api.substr(0, 1) !== '/' ? '/api/'+api : api;

        if(method === 'GET') {
            const data = this.$api.mergePost( that.serializeObject(), api );
            path += '?' + this.urlEncode(data);
        }
        else if(that.find('input[type="file"]:not([disabled])').length > 0)
        {
            that.attr('enctype', 'multipart/form-data');
            data = new FormData(elm);
        }
        else
        {
            that.attr('enctype', 'application/json');
            data = that.serializeObject();
            data = JSON.stringify( this.$api.mergePost(data, api) );
        }

        $.ajax({
            url: path,
            type: method,
            global: false,
            xhr: function()
            {
                var myXhr = $.ajaxSettings.xhr();
                if(myXhr.upload){ // Check if upload property exists
                    myXhr.upload.addEventListener('progress',function(p)
                    {
                        const progress = Math.round(p.position * 100 / p.totalSize, 3);
                        _this.trigger(elm, 'api-progress', { progress: progress, progressEvent: p, api: api });
                    }, false);
                }
                return myXhr;
            },
            beforeSend: function()
            {
                _this.trigger(elm, 'api-prepare', { api: api });
            },
            success: function(e)
            {
                if(that.attr('response-type')) {
                    if(that.attr('response-type') !== "application/json" && that.attr('response-type') !== "json") {
                        const res = { api: api, result: e };
                        _this.trigger(elm, 'api-success', res);
                        return _this.trigger(elm, 'api-done', res);
                    }
                }
                
                if(typeof(e) != 'object')
                {
                    try
                    {
                        e = JSON.parse(e);
                    }
                    catch(err)
                    {
                        const res = { api: api, result: { error: 'An internal conversion error occured' }, error: 'An internal conversion error occured', plain: e };
                        _this.trigger(elm, 'api-error', res);
                        return _this.trigger(elm, 'api-done', res);
                    }
                }

                if(e.error)
                {
                    _this.trigger(elm, 'api-error', { error: e.error, result: e, api: api });
                }
                else
                {
                    _this.trigger(elm, 'api-success', { api: api, result: e });
                }

                _this.trigger(elm, 'api-done', { api: api, result: e });
            },
            error: function(err)
            {
                if(err.responseText)
                {
                    try
                    {
                        const json = JSON.parse(err.responseText);
                        const res =  { result: json, api: api, error: json.error, status: err.status };

                        if(err.status === 401 && _this.handleAccessDenied)
                            _this.handleAccessDenied(json, api);

                        _this.trigger(elm, 'api-error', res);
                        _this.trigger(elm, 'api-done',  res);
                        return;
                    }
                    catch(e)
                    {
                        const resType = err.getResponseHeader ? err.getResponseHeader('Content-Type') : null;

                        if(resType && resType.indexOf('text/html') !== -1) {
                            if(err.status === 401 && _this.handleAccessDenied)
                                _this.handleAccessDenied({ error: err.status + ' - ' + err.statusText }, api);

                            const errRes = { result: err, error: err.status + ' - ' + err.statusText, api: api, status: err.status };
                            _this.trigger(elm, 'api-error', errRes);
                            _this.trigger(elm, 'api-done', errRes);
                            return;
                        }

                        if(err.status === 401 && _this.handleAccessDenied)
                            _this.handleAccessDenied({ error: err.responseText }, api);

                        const errRes2 = { result: err, error: err.responseText, api: api, status: err.status };
                        _this.trigger(elm, 'api-error', errRes2);
                        _this.trigger(elm, 'api-done', errRes2);
                        return;
                    }
                }

                if(err.status === 401 && _this.handleAccessDenied)
                    _this.handleAccessDenied({ error: err }, api);

                _this.trigger(elm, 'api-error', { result: err, error: err, api: api });
                _this.trigger(elm, 'api-done',  { result: err, error: err, api: api });
            },
            data: (method !== 'GET') ? data : null,
            cache: false,
            contentType: that.attr('enctype'),
            processData: false
        });
    }
}

if(!FormPoster.shared)
    FormPoster.shared = new FormPoster();

export default FormPoster.shared;