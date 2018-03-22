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

        /*$(document).off('submit', 'form');
        $(document).on('submit', 'form', function(e)
        {
            if(!$(this).attr('action'))
                return;

            e.preventDefault();
            _this.handleFormSubmit(this);
        });*/
    }
    
    notify(type, message) {
        console.log('todo notify', type, message);
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
        const _this = this;
        const api   = elm.getAttribute('action');
        var data = null;

        //that.trigger('api-before-submit', elm);
        this.trigger(elm, 'api-before-submit', { api: api });

        if(that.find('input[type="file"]:not([disabled])').length > 0)
        {
            that.attr('enctype', 'multipart/form-data');
            data = new FormData(elm);
        }
        else
        {
            form.setAttribute('enctype', 'application/json');
            //data = that.serializeObject();
            //data = JSON.stringify( this.$api.mergePost(data, api) );
        }

        this.trigger(elm, 'api-prepare', { api: api });
        
        return this.$api.post('/api/'+api, data).then((res) => {
            this.trigger(elm, 'api-success', { api: api, result: res });
            return res;
        }).catch((err) => {
            this.trigger(elm, 'api-error', { api: api, result: err, error: err.error || err.message || err });
            return err;
        }).then((res) => {
            this.trigger(elm, 'api-done', { api: api, result: res });
        });
    }
}

if(!FormPoster.shared)
    FormPoster.shared = new FormPoster();

export default FormPoster.shared;