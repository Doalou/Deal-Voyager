export default defineEventHandler(async (event) => {
    const { apiInternalUrl } = useRuntimeConfig()
    const path = event.context.params?._ || ''
    const query = getRequestURL(event).search
    return proxyRequest(event, `${apiInternalUrl}/api/v1/${path}${query}`)
})
