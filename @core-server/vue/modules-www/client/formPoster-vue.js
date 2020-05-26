const axios = require('axios')

class FormPoster
{
    constructor() {
        const _this = this;
        this.events = {
            'api-progress': this.handleApiProgress,
            'api-prepare':  this.handleApiPrepare,
            'api-error':    this.handleApiError,
            'api-success':  this.handleApiSuccess,
            'api-done':     this.handleApiDone
        };

        if(typeof(document) === 'undefined')
            return;
        
        document.addEventListener('submit', (e) => {
            const elm = e.target;
            if(!elm || (elm.tagName && String(elm.tagName).toLowerCase() !== 'form') || !elm.getAttribute('action') || e.defaultPrevented)
                return;

            e.preventDefault()
            this.handleFormSubmit(elm);
        })
    }
    
    notify(type, message) {
        // console.log('todo notify', type, message);
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

        this.notify('danger', msg);
    }

    handleApiSuccess(form, data)
    {
        const msg = data.result;

        if(form.hasAttribute('SuccessMessage'))
           return this.notify('success', form.getAttribute('SuccessMessage'));

        if(typeof(msg) == 'string')
            return this.notify('success', msg);

        if(typeof(msg) == 'object')
        {
            if(typeof(msg.result) == 'string')
                return this.notify('success', msg.result);
        }

        return this.notify('success', msg.message || 'Data successfully updated!');
    }

    handleApiPrepare(form, data)
    {
        //$(form).find('input, textarea, select, button').not(':disabled').attr('disabled', true).attr('predisabled', true);

        //ToDo: set loader icon
    }

    handleApiProgress(form, data)
    {
        //ToDo set progress in button
    }

    handleApiDone(form)
    {
        //$(form).find('[predisabled]').removeAttr('disabled').removeAttr('predisabled');
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

    handleFormSubmit(elm)
    {
        const api = elm.getAttribute('action');
        var data  = null;

        //that.trigger('api-before-submit', elm);
        this.trigger(elm, 'api-before-submit', { api: api });

        if(elm.querySelectorAll('input[type="file"]:not([disabled])').length > 0) {
            elm.attr('enctype', 'multipart/form-data');
            data = new FormData(elm);
        }
        else {
            elm.setAttribute('enctype', 'application/json');
            data = this.$api.mergePost(serializeObject(elm), api);
        }

        this.trigger(elm, 'api-prepare', { api: api });
        
        return this.$post(api, data).then((res) => {
            this.trigger(elm, 'api-success', { api: api, result: res });
            return res;
        }).catch((err) => {
            if(err.status == 524)
                this.trigger(elm, 'api-error', { api: api, result: err, error: "timeout", status: err.status });
            else
                this.trigger(elm, 'api-error', { api: api, result: err, error: err.error || err.message || err, status: err.status });
            return err;
        }).then((res) => {
            this.trigger(elm, 'api-done', { api: api, result: res });
        });
    }

    $post(api, post) {
        return axios.post(api.substr(0, 1) === '/' ? api : '/api/' + api, post).then((res) => {
            return res.data
        }).catch((err) => {
            const isStatus = (status) => (err.status === status || (err.response && err.response.status === status))
            if(isStatus(401) || isStatus(403)) {
                var data = (err && err.response && err.response.data) || err
                if(isStatus(401) && data.location)
                    location.href = data.location
            }
    
            if(err && err.response && err.response.data) {
                var data = err.response.data;
                try {
                    data = typeof(err.response.data) !== "object" ? JSON.parse(err.response.data) : err.response.data;
                } catch(e) {
                    console.error('error with data', err.response.data, '=>', e);
                }
    
                throw({
                    error: data ? (data.error || data.message || data) : data,
                    status: err.response.status || err.status,
                })
            }
    
            throw({
                error: err.error || err.message || err,
                status: (err.response && err.response.status) || err.status,
            })
        })
    }
}

if(!FormPoster.shared)
    FormPoster.shared = new FormPoster();

export default FormPoster.shared;

// ------------


function serializeObject(form) {
    var o = {};
    var elements = form.querySelectorAll(("input,textarea"));
    for(var key in elements) {
        const elm = elements[key]
        if(elm.disabled || !elm.name || typeof(elm) === 'function')
            continue

        if (o[elm.name] !== undefined) {
            if (!o[elm.name].push) {
                o[elm.name] = [o[elm.name]];
            }

            o[elm.name].push(elm.value || '');
        } else {
            o[elm.name] = elm.value || '';
        }
    }

    return o;
};