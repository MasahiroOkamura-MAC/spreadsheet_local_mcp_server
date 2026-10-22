import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import type { RequestHandler } from 'express';

export function authOrigin(): string {
    const port = process.env.PORT || '8080';
    if (!/^\d+$/.test(port) || Number(port) < 1 || Number(port) > 65535) throw new Error('Invalid auth port');
    return `http://localhost:${Number(port)}`;
}

export const localRequestGuard: RequestHandler = (req, res, next) => {
    const origin = authOrigin();
    const alternate = origin.replace('localhost', '127.0.0.1');
    const hosts = [new URL(origin).host, new URL(alternate).host];
    res.set({'Cache-Control': 'no-store', 'Referrer-Policy': 'no-referrer', 'X-Frame-Options': 'DENY', 'X-Content-Type-Options': 'nosniff'});
    if (!hosts.includes(req.get('host') || '') || req.get('sec-fetch-site') === 'cross-site' && req.method !== 'GET') {
        res.status(403).send('Local requests only'); return;
    }
    const suppliedOrigin = req.get('origin');
    if (suppliedOrigin && ![origin, alternate].includes(suppliedOrigin) || req.method === 'POST' && !suppliedOrigin) {
        res.status(403).send('Invalid request origin'); return;
    }
    next();
};

export function browserBinding(cookie: string | undefined): string | undefined {
    return cookie?.split(';').map(x => x.trim()).find(x => /^mcp_auth=[a-f0-9]{64}$/.test(x))?.slice(9);
}
export function newBinding(): string { return crypto.randomBytes(32).toString('hex'); }
export function equalBinding(a: unknown, b: unknown): boolean {
    return typeof a === 'string' && typeof b === 'string' && /^[a-f0-9]{64}$/.test(a) && /^[a-f0-9]{64}$/.test(b) && crypto.timingSafeEqual(Buffer.from(a), Buffer.from(b));
}

// Never follow token symlinks. Move legacy data before reading it, preserving compatibility.
export function tokenStore(base: string) {
    const directory = path.join(base, '.secret');
    const target = path.join(directory, 'tokens.json');
    const legacy = path.join(base, '.tokens.json');
    const check = (file: string, directory = false) => {
        const stat = fs.lstatSync(file);
        if (stat.isSymbolicLink() || (directory ? !stat.isDirectory() : !stat.isFile()) || (process.getuid && stat.uid !== process.getuid())) throw new Error('Unsafe credential storage');
        fs.chmodSync(file, directory ? 0o700 : 0o600);
    };
    const prepare = () => {
        if (!fs.existsSync(directory)) fs.mkdirSync(directory, {mode: 0o700});
        check(directory, true);
        // lstat detects dangling symlinks too.
        const exists = (file: string) => { try { fs.lstatSync(file); return true; } catch (e: any) { if (e.code === 'ENOENT') return false; throw e; } };
        if (exists(legacy)) {
            check(legacy);
            if (exists(target)) throw new Error('Multiple credential stores; reconcile locally');
            fs.renameSync(legacy, target);
        }
        if (exists(target)) check(target);
    };
    return {
        load(): Record<string, any> {
            prepare();
            try { return JSON.parse(fs.readFileSync(target, 'utf8')); }
            catch (error: any) { if (error.code === 'ENOENT') return {}; throw new Error('Unable to read credential store'); }
        },
        save(tokens: Record<string, any>) {
            prepare();
            const temporary = path.join(directory, `tokens-${crypto.randomBytes(16).toString('hex')}.json`);
            try {
                fs.writeFileSync(temporary, JSON.stringify(tokens), {mode: 0o600, flag: 'wx'});
                fs.renameSync(temporary, target);
            } finally { if (fs.existsSync(temporary)) fs.unlinkSync(temporary); }
        }
    };
}
