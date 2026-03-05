import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';

const loginAttempts = new Map<string, { count: number; lastAttempt: number }>();
const MAX_ATTEMPTS = 10;
const WINDOW_MS = 15 * 60 * 1000; // 15 minutes

function getClientIp(req: Request): string {
    const forwarded = req.headers['x-forwarded-for'];
    if (typeof forwarded === 'string') return forwarded.split(',')[0].trim();
    return req.ip || req.socket.remoteAddress || 'unknown';
}

function isRateLimited(ip: string): boolean {
    const record = loginAttempts.get(ip);
    if (!record) return false;

    if (Date.now() - record.lastAttempt > WINDOW_MS) {
        loginAttempts.delete(ip);
        return false;
    }

    return record.count >= MAX_ATTEMPTS;
}

function recordFailedAttempt(ip: string): void {
    const record = loginAttempts.get(ip);
    if (record && Date.now() - record.lastAttempt <= WINDOW_MS) {
        record.count++;
        record.lastAttempt = Date.now();
    } else {
        loginAttempts.set(ip, { count: 1, lastAttempt: Date.now() });
    }
}

function recordSuccessfulAttempt(ip: string): void {
    loginAttempts.delete(ip);
}

function timingSafeCompare(a: string, b: string): boolean {
    const bufA = Buffer.from(a);
    const bufB = Buffer.from(b);
    if (bufA.length !== bufB.length) {
        crypto.timingSafeEqual(bufA, bufA);
        return false;
    }
    return crypto.timingSafeEqual(bufA, bufB);
}

export const basicAuthMiddleware = (req: Request, res: Response, next: NextFunction) => {
    const validUsername = process.env.ADMIN_USERNAME;
    const validPassword = process.env.ADMIN_PASSWORD;

    if (!validUsername || !validPassword) {
        console.error('[AUTH] ADMIN_USERNAME and ADMIN_PASSWORD must be set in environment variables.');
        res.status(500).json({ error: 'Server authentication not configured' });
        return;
    }

    const clientIp = getClientIp(req);

    if (isRateLimited(clientIp)) {
        res.status(429).json({ error: 'Too many failed attempts. Try again later.' });
        return;
    }

    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Basic ')) {
        res.setHeader('WWW-Authenticate', 'Basic realm="Deal-Voyager API"');
        res.status(401).json({ error: 'Authentication required' });
        return;
    }

    const token = authHeader.split(' ')[1];
    let decoded: string;
    try {
        decoded = Buffer.from(token, 'base64').toString('utf-8');
    } catch {
        res.status(400).json({ error: 'Malformed authorization header' });
        return;
    }

    const separatorIndex = decoded.indexOf(':');
    if (separatorIndex === -1) {
        res.status(400).json({ error: 'Malformed authorization header' });
        return;
    }

    const username = decoded.substring(0, separatorIndex);
    const password = decoded.substring(separatorIndex + 1);

    if (timingSafeCompare(username, validUsername) && timingSafeCompare(password, validPassword)) {
        recordSuccessfulAttempt(clientIp);
        next();
    } else {
        recordFailedAttempt(clientIp);
        res.setHeader('WWW-Authenticate', 'Basic realm="Deal-Voyager API"');
        res.status(401).json({ error: 'Invalid credentials' });
    }
};
