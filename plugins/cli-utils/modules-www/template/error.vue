<template>
    <div>
        <div class="full-screen">
            <div class="mask">
                <div class="container">
                    <h2>Error {{code}}</h2>
                    <h3 v-if="code === 404">The requested page or resource could not be found</h3>
                    <h3 v-else>An unexpected error occured</h3>
                </div>
            </div>
        </div>
    </div>
</template>

<script>

export default {

    props: {

        code: {
            default: function()
            {
                if(typeof(window) === 'undefined')
                    return 404;

                return window.HTTP_STATUS || 404;
            }
        }

    }

}

</script>