'use strict';

// Lien entre appareils pour la page hydratation.
//
// Modèle : une URL « capacité ». Le secret (32 octets aléatoires) est dans
// le fragment #s=… — il ne quitte jamais le navigateur (ni requête, ni
// journal serveur, ni Referer). Tout le reste en est dérivé par HKDF :
//   - roomId     : identifiant de salle vu par le relais
//   - writeToken : droit d'écrire dans la salle (jeton présenté au relais)
//   - clé AES    : chiffrement de bout en bout de l'état
// Le relais ne stocke que du chiffré et ne peut ni lire ni forger l'état.

window.HydraSync = (function () {
    const API = 'api/hydratation';
    const STORAGE_KEY = 'hydratation-link';
    const SALT = 'hydratation-link-v1';
    const SECRET_BYTES = 32;
    const MAX_REV = 1e9;
    const PAST_WINDOW_MS = 48 * 60 * 60 * 1000;
    const FUTURE_WINDOW_MS = 2 * 60 * 1000;
    const RETRY_MS = 3000;

    const textEncoder = new TextEncoder();
    const textDecoder = new TextDecoder();
    const B64 = /^[A-Za-z0-9_-]{43}$/;

    function supported() {
        return Boolean(
            window.isSecureContext &&
            window.crypto &&
            window.crypto.subtle &&
            window.crypto.getRandomValues &&
            window.EventSource &&
            window.fetch
        );
    }

    function toB64url(bytes) {
        let binary = '';
        for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
        return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
    }

    function fromB64url(text) {
        if (typeof text !== 'string' || !/^[A-Za-z0-9_-]+$/.test(text)) return null;
        const padded = text.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((text.length + 3) % 4);
        try {
            const binary = atob(padded);
            const bytes = new Uint8Array(binary.length);
            for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
            return bytes;
        } catch (e) {
            return null;
        }
    }

    async function derive(secret) {
        const subtle = window.crypto.subtle;
        const base = await subtle.importKey('raw', secret, 'HKDF', false, ['deriveBits']);
        const bits = async (info) => {
            const out = await subtle.deriveBits(
                { name: 'HKDF', hash: 'SHA-256', salt: textEncoder.encode(SALT), info: textEncoder.encode(info) },
                base,
                256
            );
            return new Uint8Array(out);
        };
        const roomId = toB64url(await bits('room'));
        const writeToken = toB64url(await bits('write'));
        const key = await subtle.importKey('raw', await bits('enc'), { name: 'AES-GCM' }, false, ['encrypt', 'decrypt']);
        return { roomId, writeToken, key };
    }

    function aad(roomId, rev) {
        return textEncoder.encode(roomId + ':' + rev);
    }

    async function encrypt(derived, rev, state) {
        const iv = new Uint8Array(12);
        window.crypto.getRandomValues(iv);
        const plain = textEncoder.encode(JSON.stringify(state));
        const ct = await window.crypto.subtle.encrypt(
            { name: 'AES-GCM', iv: iv, additionalData: aad(derived.roomId, rev) },
            derived.key,
            plain
        );
        return { rev: rev, iv: toB64url(iv), ct: toB64url(new Uint8Array(ct)) };
    }

    async function decrypt(derived, blob) {
        if (!blob || typeof blob !== 'object') return null;
        if (!Number.isInteger(blob.rev) || blob.rev < 1 || blob.rev > MAX_REV) return null;
        const iv = fromB64url(blob.iv);
        const ct = fromB64url(blob.ct);
        if (!iv || iv.length !== 12 || !ct || ct.length < 16 || ct.length > 1100) return null;
        try {
            const plain = await window.crypto.subtle.decrypt(
                { name: 'AES-GCM', iv: iv, additionalData: aad(derived.roomId, blob.rev) },
                derived.key,
                ct
            );
            return JSON.parse(textDecoder.decode(plain));
        } catch (e) {
            return null;
        }
    }

    function validState(state, rev) {
        if (!state || typeof state !== 'object' || Array.isArray(state)) return false;
        if (state.v !== 1) return false;
        if (state.rev !== rev) return false;
        if (typeof state.running !== 'boolean') return false;
        if (!Number.isInteger(state.interval) || state.interval < 1 || state.interval > 180) return false;
        if (typeof state.start !== 'number' || !Number.isFinite(state.start)) return false;
        if (state.running) {
            const now = Date.now();
            if (state.start > now + FUTURE_WINDOW_MS) return false;
            if (state.start < now - PAST_WINDOW_MS) return false;
        } else if (state.start !== 0) {
            return false;
        }
        return true;
    }

    function readStoredSecret() {
        try {
            const raw = sessionStorage.getItem(STORAGE_KEY);
            return raw && B64.test(raw) ? raw : null;
        } catch (e) {
            return null;
        }
    }

    function storeSecret(text) {
        try {
            if (text) sessionStorage.setItem(STORAGE_KEY, text);
            else sessionStorage.removeItem(STORAGE_KEY);
        } catch (e) {}
    }

    function secretFromHash() {
        const hash = window.location.hash || '';
        const match = /^#s=([A-Za-z0-9_-]{43})$/.exec(hash);
        if (!match) return null;
        try {
            history.replaceState(null, '', window.location.pathname + window.location.search);
        } catch (e) {}
        return match[1];
    }

    function create(options) {
        const onState = options.onState || function () {};
        const onStatus = options.onStatus || function () {};

        let secretText = null;
        let derived = null;
        let rev = 0;
        let source = null;
        let status = 'off';
        let retryTimer = 0;
        let pending = null;
        let publishing = false;
        let generation = 0;

        function setStatus(next) {
            if (status === next) return;
            status = next;
            onStatus(next);
        }

        async function handleBlob(blob) {
            if (!derived || !blob || !Number.isInteger(blob.rev) || blob.rev <= rev) return false;
            const state = await decrypt(derived, blob);
            if (!validState(state, blob.rev)) return false;
            if (blob.rev <= rev) return false;
            rev = blob.rev;
            onState(state);
            return true;
        }

        function closeSource() {
            if (source) {
                try { source.close(); } catch (e) {}
                source = null;
            }
        }

        function connect() {
            closeSource();
            if (!derived) return;
            const gen = ++generation;
            setStatus('connecting');
            const es = new EventSource(API + '/rooms/' + derived.roomId + '/events');
            source = es;
            es.addEventListener('state', (event) => {
                if (gen !== generation) return;
                let blob = null;
                try { blob = JSON.parse(event.data); } catch (e) { return; }
                handleBlob(blob);
            });
            es.onopen = () => {
                if (gen === generation) setStatus('connected');
            };
            es.onerror = () => {
                if (gen !== generation) return;
                setStatus(es.readyState === EventSource.CLOSED ? 'error' : 'reconnecting');
                if (es.readyState === EventSource.CLOSED) {
                    clearTimeout(retryTimer);
                    retryTimer = setTimeout(() => {
                        if (gen === generation && derived) connect();
                    }, RETRY_MS);
                }
            };
        }

        async function refresh() {
            if (!derived) return;
            try {
                const res = await fetch(API + '/rooms/' + derived.roomId, { cache: 'no-store', credentials: 'omit' });
                if (res.status === 200) {
                    const blob = await res.json();
                    await handleBlob(blob);
                }
            } catch (e) {}
            if (source && source.readyState === EventSource.CLOSED) connect();
        }

        async function adopt(text) {
            if (!supported()) {
                setStatus('unsupported');
                return false;
            }
            const bytes = fromB64url(text);
            if (!bytes || bytes.length !== SECRET_BYTES) return false;
            secretText = text;
            derived = await derive(bytes);
            rev = 0;
            storeSecret(text);
            connect();
            return true;
        }

        async function link() {
            if (secretText) return url();
            if (!supported()) {
                setStatus('unsupported');
                return null;
            }
            const bytes = new Uint8Array(SECRET_BYTES);
            window.crypto.getRandomValues(bytes);
            const ok = await adopt(toB64url(bytes));
            return ok ? url() : null;
        }

        function unlink() {
            generation += 1;
            clearTimeout(retryTimer);
            closeSource();
            secretText = null;
            derived = null;
            rev = 0;
            pending = null;
            storeSecret(null);
            setStatus('off');
        }

        function url() {
            if (!secretText) return null;
            return window.location.origin + window.location.pathname + '#s=' + secretText;
        }

        async function flush() {
            if (publishing || !pending || !derived) return;
            publishing = true;
            const state = pending;
            pending = null;
            const myDerived = derived;
            const nextRev = rev + 1;
            try {
                const payload = Object.assign({ v: 1, rev: nextRev }, state);
                const blob = await encrypt(myDerived, nextRev, payload);
                const res = await fetch(API + '/rooms/' + myDerived.roomId, {
                    method: 'PUT',
                    cache: 'no-store',
                    credentials: 'omit',
                    headers: { 'Content-Type': 'application/json', 'X-Write-Token': myDerived.writeToken },
                    body: JSON.stringify(blob)
                });
                if (derived !== myDerived) return;
                if (res.status === 200) {
                    if (nextRev > rev) rev = nextRev;
                } else if (res.status === 409) {
                    // Un autre appareil a écrit entre-temps : son état gagne
                    // et s'applique ici ; le nôtre est abandonné. Si ce que
                    // renvoie le relais est illisible ou invalide, on dépasse
                    // son numéro de révision et on réécrit le nôtre.
                    const body = await res.json().catch(() => null);
                    const remote = body && body.state;
                    const applied = remote ? await handleBlob(remote) : false;
                    if (remote && Number.isInteger(remote.rev) && remote.rev > rev && remote.rev <= MAX_REV) rev = remote.rev;
                    if (!applied && pending === null) pending = state;
                } else if (res.status === 403) {
                    setStatus('refused');
                } else {
                    if (pending === null) pending = state;
                    scheduleRetry();
                }
            } catch (e) {
                if (derived !== myDerived) return;
                if (pending === null) pending = state;
                scheduleRetry();
            } finally {
                publishing = false;
                if (pending && derived) flush();
            }
        }

        function scheduleRetry() {
            clearTimeout(retryTimer);
            retryTimer = setTimeout(() => {
                if (derived) flush();
            }, RETRY_MS);
        }

        function publish(state) {
            if (!derived) return;
            pending = {
                running: Boolean(state.running),
                start: state.running ? Math.round(state.start) : 0,
                interval: state.interval
            };
            flush();
        }

        async function boot() {
            const fromHash = secretFromHash();
            const text = fromHash || readStoredSecret();
            if (!text) return false;
            return adopt(text);
        }

        document.addEventListener('visibilitychange', () => {
            if (document.visibilityState === 'visible' && derived) refresh();
        });
        window.addEventListener('online', () => {
            if (derived) refresh();
        });

        return {
            boot: boot,
            link: link,
            unlink: unlink,
            publish: publish,
            refresh: refresh,
            url: url,
            isLinked: () => Boolean(derived),
            status: () => status,
            supported: supported
        };
    }

    return { create: create, supported: supported };
})();
