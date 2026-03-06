export default defineNuxtPlugin(() => {
    const config = useRuntimeConfig()
    const matomoUrl = config.public.matomoUrl as string
    const siteId = config.public.matomoSiteId as string

    if (!matomoUrl || !siteId) {
        return
    }

    const u = matomoUrl.endsWith('/') ? matomoUrl : matomoUrl + '/'

    // Standard Matomo tracking code
    const _paq = ((window as any)._paq = (window as any)._paq || [])
    _paq.push(['trackPageView'])
    _paq.push(['enableLinkTracking'])
    _paq.push(['setTrackerUrl', u + 'matomo.php'])
    _paq.push(['setSiteId', siteId])

    const d = document
    const g = d.createElement('script')
    g.async = true
    g.src = u + 'matomo.js'
    d.head.appendChild(g)

    // Track SPA navigations
    const router = useRouter()
    router.afterEach((to) => {
        const _paq = (window as any)._paq
        if (_paq) {
            _paq.push(['setCustomUrl', window.location.origin + to.fullPath])
            _paq.push(['setDocumentTitle', document.title])
            _paq.push(['trackPageView'])
        }
    })
})
