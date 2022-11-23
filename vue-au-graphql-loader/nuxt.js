import { defineNuxtModule, extendViteConfig, addImports } from '@nuxt/kit'
import plugin from './src/index.js'

// export module
export default defineNuxtModule({
    async setup(options) {
        await addImports([
            { name: "useGraphql", from: __dirname + '/composables' },
        ])

        // register vue compiler and web extensions
        extendViteConfig((config) => {
            config.plugins.push(plugin.vite(options))
        })
    }
})