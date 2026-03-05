import { setResponseHeader, sendError, createError } from 'h3'

function timingSafeCompare(a: string, b: string): boolean {
    if (a.length !== b.length) {
        let dummy = 0
        for (let i = 0; i < a.length; i++) dummy |= a.charCodeAt(i) ^ a.charCodeAt(i)
        return false
    }
    let result = 0
    for (let i = 0; i < a.length; i++) {
        result |= a.charCodeAt(i) ^ b.charCodeAt(i)
    }
    return result === 0
}

export default defineNuxtRouteMiddleware((to, from) => {
    if (import.meta.client && to.path === '/admin') {
        const authToken = useState<string | null>('authToken')
        if (!authToken.value && from.path !== to.path) {
            window.location.href = to.fullPath
            return false
        }
    }

    if (import.meta.server) {
        const event = useRequestEvent()
        if (!event) return

        const req = event.node.req
        const authHeader = req.headers.authorization

        const validUsername = process.env.ADMIN_USERNAME
        const validPassword = process.env.ADMIN_PASSWORD

        if (!validUsername || !validPassword) {
            return sendError(event, createError({ statusCode: 500, statusMessage: 'Server auth not configured' }))
        }

        if (authHeader && authHeader.startsWith('Basic ')) {
            try {
                const token = authHeader.split(' ')[1]
                const decoded = Buffer.from(token, 'base64').toString('utf-8')
                const separatorIndex = decoded.indexOf(':')
                if (separatorIndex === -1) throw new Error('invalid')

                const username = decoded.substring(0, separatorIndex)
                const password = decoded.substring(separatorIndex + 1)

                if (timingSafeCompare(username, validUsername) && timingSafeCompare(password, validPassword)) {
                    useState<string | null>('authToken', () => authHeader)
                    return
                }
            } catch {
                // fall through to 401
            }
        }

        setResponseHeader(event, 'WWW-Authenticate', 'Basic realm="Deal-Voyager Admin"')
        return sendError(event, createError({ statusCode: 401, statusMessage: 'Non autorisé' }))
    }
})
