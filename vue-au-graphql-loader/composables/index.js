import { getCurrentInstance } from 'vue'

export function useGraphql(data) {
    const instance = getCurrentInstance()
    const $gql = instance.type.$gql || {}

    for(var e in $gql) {
        return $gql[e].query.use(instance, data)
    }

    throw('no graphql query found')
}