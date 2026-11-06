'use strict';

// Relais de synchronisation pour la page hydratation.
//
// Le serveur ne voit jamais la clé de session : elle vit dans le fragment
// d'URL (#s=...) du navigateur. Il ne stocke que des blobs chiffrés
// (AES-GCM côté client) indexés par un identifiant dérivé de la clé.
// Lire un blob sans la clé ne révèle rien ; écrire exige un jeton dérivé
// lui aussi de la clé, fixé par le premier écrivain de la salle.
//
// Aucune dépendance. Tout est en mémoire et expire tout seul.

const http = require('http');
const crypto = require('crypto');

const PORT = Number(process.env.PORT) || 3000;
const HOST = process.env.HOST || '0.0.0.0';
const TRUST_PROXY = process.env.TRUST_PROXY === '1';

const ROOM_TTL_MS = 12 * 60 * 60 * 1000;
const MAX_ROOMS = 5000;
const MAX_BODY_BYTES = 4096;
const MAX_CT_CHARS = 1400;
const MAX_LISTENERS_PER_ROOM = 8;
const MAX_LISTENERS_PER_IP = 12;
const MAX_LISTENERS_TOTAL = 1000;
const HEARTBEAT_MS = 25000;
const RATE_CAPACITY = 60;
const RATE_REFILL_PER_SEC = 0.5;

const ROOM_ID = /^[A-Za-z0-9_-]{43}$/;
const TOKEN = /^[A-Za-z0-9_-]{43}$/;
const IV = /^[A-Za-z0-9_-]{16}$/;
const CT = /^[A-Za-z0-9_-]{24,1400}$/;
const ROUTE = /^\/rooms\/([A-Za-z0-9_-]{43})(\/events)?$/;

const rooms = new Map();
const buckets = new Map();
const listenersByIp = new Map();
let listenersTotal = 0;

function now() {
    return Date.now();
}

function clientIp(req) {
    if (TRUST_PROXY) {
        const header = req.headers['x-forwarded-for'];
        if (typeof header === 'string' && header.length > 0) {
            const first = header.split(',')[0].trim();
            if (first.length > 0 && first.length <= 64) return first;
        }
    }
    return req.socket.remoteAddress || 'unknown';
}

function allow(ip, cost) {
    const t = now();
    let bucket = buckets.get(ip);
    if (!bucket) {
        bucket = { tokens: RATE_CAPACITY, at: t };
        buckets.set(ip, bucket);
    }
    const elapsed = (t - bucket.at) / 1000;
    bucket.tokens = Math.min(RATE_CAPACITY, bucket.tokens + elapsed * RATE_REFILL_PER_SEC);
    bucket.at = t;
    if (bucket.tokens < cost) return false;
    bucket.tokens -= cost;
    return true;
}

function sha256(text) {
    return crypto.createHash('sha256').update(text, 'utf8').digest();
}

function safeEqual(a, b) {
    return a.length === b.length && crypto.timingSafeEqual(a, b);
}

function baseHeaders(extra) {
    return Object.assign({
        'Cache-Control': 'no-store',
        'X-Content-Type-Options': 'nosniff',
        'Referrer-Policy': 'no-referrer'
    }, extra || {});
}

function sendJson(res, status, body) {
    const text = JSON.stringify(body);
    res.writeHead(status, baseHeaders({
        'Content-Type': 'application/json; charset=utf-8',
        'Content-Length': Buffer.byteLength(text)
    }));
    res.end(text);
}

function sendError(res, status, code) {
    sendJson(res, status, { error: code });
}

function readBody(req) {
    return new Promise((resolve, reject) => {
        const declared = Number(req.headers['content-length']);
        if (Number.isFinite(declared) && declared > MAX_BODY_BYTES) {
            reject(new Error('too-large'));
            return;
        }
        const chunks = [];
        let size = 0;
        req.on('data', (chunk) => {
            size += chunk.length;
            if (size > MAX_BODY_BYTES) {
                reject(new Error('too-large'));
                req.destroy();
                return;
            }
            chunks.push(chunk);
        });
        req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
        req.on('error', reject);
    });
}

function publicState(room) {
    return { rev: room.rev, iv: room.iv, ct: room.ct };
}

function sameOrigin(req) {
    const site = req.headers['sec-fetch-site'];
    if (site === undefined) return true;
    return site === 'same-origin' || site === 'none';
}

function touch(room) {
    room.expiresAt = now() + ROOM_TTL_MS;
}

function broadcast(room) {
    const payload = 'event: state\ndata: ' + JSON.stringify(publicState(room)) + '\n\n';
    for (const res of room.listeners) {
        try {
            res.write(payload);
        } catch (e) {
            detach(room, res);
        }
    }
}

function detach(room, res) {
    if (!room.listeners.has(res)) return;
    room.listeners.delete(res);
    listenersTotal -= 1;
    const ip = res.__ip;
    const count = (listenersByIp.get(ip) || 1) - 1;
    if (count <= 0) listenersByIp.delete(ip);
    else listenersByIp.set(ip, count);
}

async function handlePut(req, res, ip, roomId) {
    if (!sameOrigin(req)) return sendError(res, 403, 'origin');
    if (!allow(ip, 1)) return sendError(res, 429, 'rate');

    const token = req.headers['x-write-token'];
    if (typeof token !== 'string' || !TOKEN.test(token)) return sendError(res, 403, 'token');

    let text;
    try {
        text = await readBody(req);
    } catch (e) {
        return sendError(res, 413, 'too-large');
    }

    let body;
    try {
        body = JSON.parse(text);
    } catch (e) {
        return sendError(res, 400, 'json');
    }
    if (!body || typeof body !== 'object' || Array.isArray(body)) return sendError(res, 400, 'shape');
    const rev = body.rev;
    const iv = body.iv;
    const ct = body.ct;
    if (!Number.isInteger(rev) || rev < 1 || rev > 1e9) return sendError(res, 400, 'rev');
    if (typeof iv !== 'string' || !IV.test(iv)) return sendError(res, 400, 'iv');
    if (typeof ct !== 'string' || ct.length > MAX_CT_CHARS || !CT.test(ct)) return sendError(res, 400, 'ct');

    const tokenHash = sha256(token);
    let room = rooms.get(roomId);

    if (!room) {
        if (rooms.size >= MAX_ROOMS) return sendError(res, 503, 'full');
        if (!allow(ip, 5)) return sendError(res, 429, 'rate');
        room = { rev: 0, iv: '', ct: '', tokenHash: tokenHash, expiresAt: 0, listeners: new Set() };
        rooms.set(roomId, room);
    } else if (room.tokenHash === null) {
        // Salle ouverte par un simple abonné : le premier écrivain la revendique.
        if (!allow(ip, 5)) return sendError(res, 429, 'rate');
        room.tokenHash = tokenHash;
    } else if (!safeEqual(room.tokenHash, tokenHash)) {
        return sendError(res, 403, 'token');
    }

    if (rev <= room.rev) {
        touch(room);
        return sendJson(res, 409, { error: 'stale', state: publicState(room) });
    }

    room.rev = rev;
    room.iv = iv;
    room.ct = ct;
    touch(room);
    broadcast(room);
    return sendJson(res, 200, { rev: room.rev });
}

function handleGet(req, res, ip, roomId) {
    if (!allow(ip, 1)) return sendError(res, 429, 'rate');
    const room = rooms.get(roomId);
    if (!room || room.rev === 0) return sendError(res, 404, 'missing');
    return sendJson(res, 200, publicState(room));
}

function handleEvents(req, res, ip, roomId) {
    if (!allow(ip, 2)) return sendError(res, 429, 'rate');
    if (listenersTotal >= MAX_LISTENERS_TOTAL) return sendError(res, 503, 'busy');
    if ((listenersByIp.get(ip) || 0) >= MAX_LISTENERS_PER_IP) return sendError(res, 429, 'listeners');

    let room = rooms.get(roomId);
    if (!room) {
        if (rooms.size >= MAX_ROOMS) return sendError(res, 503, 'full');
        room = { rev: 0, iv: '', ct: '', tokenHash: null, expiresAt: 0, listeners: new Set() };
        rooms.set(roomId, room);
    }
    if (room.listeners.size >= MAX_LISTENERS_PER_ROOM) return sendError(res, 429, 'listeners');
    touch(room);

    res.writeHead(200, baseHeaders({
        'Content-Type': 'text/event-stream; charset=utf-8',
        'Connection': 'keep-alive',
        'X-Accel-Buffering': 'no'
    }));
    res.write('retry: 3000\n\n');
    if (room.rev > 0) {
        res.write('event: state\ndata: ' + JSON.stringify(publicState(room)) + '\n\n');
    }

    res.__ip = ip;
    room.listeners.add(res);
    listenersTotal += 1;
    listenersByIp.set(ip, (listenersByIp.get(ip) || 0) + 1);

    const heartbeat = setInterval(() => {
        try {
            res.write(': ping\n\n');
        } catch (e) {
            cleanup();
        }
    }, HEARTBEAT_MS);

    const cleanup = () => {
        clearInterval(heartbeat);
        detach(room, res);
    };
    req.on('close', cleanup);
    req.on('error', cleanup);
    res.on('error', cleanup);
}

function sweep() {
    const t = now();
    for (const [id, room] of rooms) {
        if (room.expiresAt > t) continue;
        for (const res of room.listeners) {
            try { res.end(); } catch (e) {}
            detach(room, res);
        }
        rooms.delete(id);
    }
    for (const [ip, bucket] of buckets) {
        if (t - bucket.at > 10 * 60 * 1000) buckets.delete(ip);
    }
}

function handler(req, res) {
    const ip = clientIp(req);
    const url = req.url || '/';
    const path = url.split('?')[0];

    if (path === '/health') {
        return sendJson(res, 200, { ok: true, rooms: rooms.size });
    }

    const match = ROUTE.exec(path);
    if (!match || !ROOM_ID.test(match[1])) return sendError(res, 404, 'route');
    const roomId = match[1];
    const wantsEvents = Boolean(match[2]);

    if (wantsEvents) {
        if (req.method !== 'GET') return sendError(res, 405, 'method');
        return handleEvents(req, res, ip, roomId);
    }
    if (req.method === 'GET') return handleGet(req, res, ip, roomId);
    if (req.method === 'PUT') {
        handlePut(req, res, ip, roomId).catch(() => {
            try { sendError(res, 500, 'internal'); } catch (e) {}
        });
        return undefined;
    }
    return sendError(res, 405, 'method');
}

function createServer() {
    const server = http.createServer(handler);
    server.requestTimeout = 0;
    server.headersTimeout = 30000;
    server.keepAliveTimeout = 65000;
    return server;
}

if (require.main === module) {
    const server = createServer();
    const sweeper = setInterval(sweep, 60000);
    server.listen(PORT, HOST, () => {
        console.log('hydratation-sync à l\'écoute sur ' + HOST + ':' + PORT + (TRUST_PROXY ? ' (proxy approuvé)' : ''));
    });
    const shutdown = () => {
        clearInterval(sweeper);
        server.close(() => process.exit(0));
        setTimeout(() => process.exit(0), 2000).unref();
    };
    process.on('SIGTERM', shutdown);
    process.on('SIGINT', shutdown);
}

module.exports = { handler, createServer, sweep, rooms };
