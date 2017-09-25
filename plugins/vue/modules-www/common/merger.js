
function vueMerge(vueObject, nData)
{
    try
    {
        if(vueObject.initialData == undefined)
           vueObject.initialData =  JSON.parse(JSON.stringify(vueObject._data));

        if(nData instanceof Array)
            nData = { items: nData };
        if(nData.push) //SSR
            nData = { items: nData };

        //Analyse simple properties
        for(var key in nData)
        {
            if(vueObject[key] != nData[key] && vueObject[key] !== undefined)
            {
                Vue.set(vueObject, key, nData[key]);
            }
        }

        if(nData.items instanceof Array)
        {
            if(nData.items.length === 1)
            {
                nData = nData.items[0];

                for(var key in nData)
                {
                    if(vueObject[key] != nData[key] && vueObject[key] !== undefined)
                    {
                        Vue.set(vueObject, key, nData[key]);
                    }
                }

                if(vueObject.info instanceof Object)
                {
                    vueObject.info = nData;
                }
            }
        }

        vueObject.$forceUpdate();
    }
    catch(e)
    {
        console.error(e);
    }

    return vueObject;
}

export default vueMerge;