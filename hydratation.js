'use strict';

const ASSET_VERSION = '1';
const MIN_MINUTES = 1;
const MAX_MINUTES = 180;
const DRINK_MS = 10000;
const HORIZON_SEC = 8 * 60 * 60;
const MINUTES_KEY = 'hydratation-minutes';
const VOLUME_KEY = 'hydratation-volume';
const RING_C = 2 * Math.PI * 54;

const app = document.getElementById('app');
const stage = document.getElementById('stage');
const kickerText = document.getElementById('kicker-text');
const pulse = document.getElementById('pulse');
const timeEl = document.getElementById('time');
const whenEl = document.getElementById('when');
const ring = document.getElementById('ring');
const presetButtons = Array.from(document.querySelectorAll('.preset'));
const minusBtn = document.getElementById('minus');
const plusBtn = document.getElementById('plus');
const minutesInput = document.getElementById('minutes');
const unitEl = document.getElementById('unit');
const toggleBtn = document.getElementById('toggle');
const previewBtn = document.getElementById('preview');
const volumeInput = document.getElementById('volume');
const statusEl = document.getElementById('status');
const errorEl = document.getElementById('error');
const liveEl = document.getElementById('live');
const soundGate = document.getElementById('sound-gate');
const shareToggle = document.getElementById('share-toggle');
const shareToggleText = document.getElementById('share-toggle-text');
const shareDot = document.getElementById('share-dot');
const sharePanel = document.getElementById('share-panel');
const shareSync = document.getElementById('share-sync');
const shareQr = document.getElementById('share-qr');
const shareCopy = document.getElementById('share-copy');
const shareNative = document.getElementById('share-native');
const shareUnlink = document.getElementById('share-unlink');

let minutes = 15;
let volume = 50;
let inputValid = true;
let running = false;
let arming = false;
let wallStart = 0;
let announcedAlarm = 0;
let runToken = 0;
let previewToken = 0;
let previewTimer = 0;
let loopGen = 0;
let lastLagCheck = 0;
let lastMakeupAt = 0;
let recovering = false;

let audioCtx = null;
let workletNode = null;
let audioMode = null;
let armPromise = null;
let htmlAudio = null;
let keepAliveUrl = '';
let noiseSource = null;
let fallbackGain = null;
let chimeBuffer = null;
let fallbackSources = [];
let fallbackTimer = 0;
let audioMark = null;
let wakeLock = null;
let unlockSource = null;

let sync = null;
let soundLive = false;
let soundToken = 0;
let statusNote = '';
let intervalPublishTimer = 0;
let copyTimer = 0;

function elapsedAlarms(elapsedMs, intervalMs) {
    if (intervalMs <= 0 || elapsedMs < intervalMs) return 0;
    return Math.floor(elapsedMs / intervalMs);
}

function remainingFromElapsed(elapsedMs, intervalMs) {
    if (intervalMs <= 0) return 0;
    if (elapsedMs <= 0) return intervalMs;
    const mod = elapsedMs % intervalMs;
    return mod === 0 ? intervalMs : intervalMs - mod;
}

function formatTime(ms) {
    const total = Math.max(0, Math.ceil(ms / 1000 - 1e-9));
    const h = Math.floor(total / 3600);
    const m = Math.floor((total % 3600) / 60);
    const s = total % 60;
    const mm = String(m).padStart(2, '0');
    const ss = String(s).padStart(2, '0');
    if (h > 0) return h + ':' + mm + ':' + ss;
    return mm + ':' + ss;
}

function formatClock(date) {
    const h = String(date.getHours()).padStart(2, '0');
    const m = String(date.getMinutes()).padStart(2, '0');
    return h + ':' + m;
}

function parseMinutes(value) {
    const text = String(value).trim();
    if (!/^\d{1,3}$/.test(text)) return null;
    const n = Number(text);
    if (n < MIN_MINUTES || n > MAX_MINUTES) return null;
    return n;
}

function readStored(key, fallback, min, max) {
    try {
        const raw = localStorage.getItem(key);
        if (raw == null || raw === '') return fallback;
        const n = Number(raw);
        if (!Number.isInteger(n) || n < min || n > max) return fallback;
        return n;
    } catch (e) {
        return fallback;
    }
}

function store(key, value) {
    try {
        localStorage.setItem(key, String(value));
    } catch (e) {}
}

function announce(text) {
    liveEl.textContent = '';
    liveEl.textContent = text;
}

function clearError() {
    errorEl.hidden = true;
    errorEl.textContent = '';
}

function showError(text) {
    errorEl.hidden = false;
    errorEl.textContent = text;
}

function currentGain() {
    return (volume / 100) * 0.85;
}

function setAudioSession(type) {
    const session = navigator.audioSession;
    if (!session) return;
    try {
        session.type = type;
    } catch (e) {}
}

function setText(node, value) {
    if (node.textContent !== value) node.textContent = value;
}

function setClock(value) {
    setText(timeEl, value);
    timeEl.classList.toggle('is-long', value.length > 5);
}

function setMinutes(next, fromInput, quiet) {
    minutes = next;
    store(MINUTES_KEY, minutes);
    if (!fromInput) minutesInput.value = String(minutes);
    if (!running) render();
    else syncControls();
    if (!quiet && !running && !arming) {
        clearTimeout(intervalPublishTimer);
        intervalPublishTimer = setTimeout(() => {
            if (!running && !arming) publishState();
        }, 600);
    }
}

function changeMinutes(delta) {
    if (running || arming) return;
    const next = Math.min(MAX_MINUTES, Math.max(MIN_MINUTES, minutes + delta));
    inputValid = true;
    setMinutes(next, false);
}

function syncControls() {
    const locked = running || arming;
    minusBtn.disabled = locked || minutes <= MIN_MINUTES;
    plusBtn.disabled = locked || minutes >= MAX_MINUTES;
    minutesInput.readOnly = locked;
    presetButtons.forEach((button) => {
        button.disabled = locked;
        button.setAttribute('aria-pressed', String(Number(button.dataset.minutes) === minutes));
    });
    toggleBtn.disabled = !running && !arming && !inputValid;
    previewBtn.disabled = arming;
    unitEl.textContent = minutes > 1 ? 'minutes' : 'minute';
}

function render() {
    const intervalMs = minutes * 60 * 1000;
    let remaining = intervalMs;
    let fired = 0;
    let drinking = false;
    let nextAt = null;

    if (running && wallStart) {
        const elapsed = Math.max(0, Date.now() - wallStart);
        fired = elapsedAlarms(elapsed, intervalMs);
        remaining = remainingFromElapsed(elapsed, intervalMs);
        drinking = fired > 0 && (elapsed % intervalMs) < DRINK_MS;
        nextAt = new Date(wallStart + (fired + 1) * intervalMs);
        if (fired !== announcedAlarm) {
            const previous = announcedAlarm;
            announcedAlarm = fired;
            if (fired > previous && drinking) announce("Bois un verre d'eau.");
        }
    }

    stage.classList.toggle('is-drinking', drinking);
    pulse.hidden = !running;
    app.dataset.state = arming ? 'arming' : running ? 'running' : 'idle';

    if (drinking) {
        setText(kickerText, 'Maintenant');
        setClock('Bois');
        setText(whenEl, "un verre d'eau");
        whenEl.classList.add('is-drink');
    } else if (running) {
        setText(kickerText, 'Prochain verre');
        setClock(formatTime(remaining));
        setText(whenEl, 'à\u00a0' + formatClock(nextAt));
        whenEl.classList.remove('is-drink');
    } else {
        setText(kickerText, 'Intervalle');
        setClock(formatTime(intervalMs));
        setText(whenEl, 'entre chaque verre');
        whenEl.classList.remove('is-drink');
    }

    const fraction = intervalMs > 0 ? remaining / intervalMs : 1;
    ring.style.strokeDasharray = String(RING_C);
    ring.style.strokeDashoffset = String(RING_C * (1 - fraction));

    if (arming) {
        setText(toggleBtn, 'Annuler');
        toggleBtn.classList.remove('is-stop');
        toggleBtn.setAttribute('aria-pressed', 'false');
        setText(statusEl, 'Préparation du son…');
    } else if (running) {
        setText(toggleBtn, 'Arrêter');
        toggleBtn.classList.add('is-stop');
        toggleBtn.setAttribute('aria-pressed', 'true');
        if (fired <= 0) setText(statusEl, 'Récupération en cours');
        else if (fired === 1) setText(statusEl, '1 verre cette récupération');
        else setText(statusEl, fired + ' verres cette récupération');
    } else {
        setText(toggleBtn, 'Lancer le rappel');
        toggleBtn.classList.remove('is-stop');
        toggleBtn.setAttribute('aria-pressed', 'false');
        setText(statusEl, statusNote || 'Prêt pour la récupération');
    }

    soundGate.hidden = !(running && !soundLive);

    const title = running
        ? formatTime(remaining) + ' · Hydratation'
        : 'Hydratation';
    if (document.title !== title) document.title = title;

    syncControls();
}

function loop() {
    const gen = ++loopGen;
    const frame = () => {
        if (gen !== loopGen || !running) return;
        render();
        maybeResync(false);
        requestAnimationFrame(frame);
    };
    requestAnimationFrame(frame);
}

function stopLoop() {
    loopGen += 1;
}

function chimeSample(t) {
    if (t < 0 || t >= 2.6) return 0;
    const attack = t < 0.18 ? t / 0.18 : 1;
    let s = Math.sin(2 * Math.PI * 740 * t) * 0.46 * Math.exp(-t * 1.15) * attack;
    s += Math.sin(2 * Math.PI * 1110 * t) * 0.12 * Math.exp(-t * 1.4) * attack;
    s += Math.sin(2 * Math.PI * 1480 * t) * 0.03 * Math.exp(-t * 1.7) * attack;
    const t2 = t - 0.55;
    if (t2 > 0) {
        const attack2 = t2 < 0.18 ? t2 / 0.18 : 1;
        s += Math.sin(2 * Math.PI * 880 * t2) * 0.18 * Math.exp(-t2 * 1.2) * attack2;
    }
    if (t > 2.3) s *= Math.max(0, (2.6 - t) / 0.3);
    return s;
}

function ensureKeepAliveUrl() {
    if (keepAliveUrl) return keepAliveUrl;
    const sampleRate = 8000;
    const n = sampleRate;
    const bytes = 44 + n * 2;
    const buffer = new ArrayBuffer(bytes);
    const view = new DataView(buffer);
    const write = (offset, text) => {
        for (let i = 0; i < text.length; i++) view.setUint8(offset + i, text.charCodeAt(i));
    };
    write(0, 'RIFF');
    view.setUint32(4, bytes - 8, true);
    write(8, 'WAVE');
    write(12, 'fmt ');
    view.setUint32(16, 16, true);
    view.setUint16(20, 1, true);
    view.setUint16(22, 1, true);
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, sampleRate * 2, true);
    view.setUint16(32, 2, true);
    view.setUint16(34, 16, true);
    write(36, 'data');
    view.setUint32(40, n * 2, true);
    for (let i = 0; i < n; i++) view.setInt16(44 + i * 2, (i & 1) ? 1 : -1, true);
    keepAliveUrl = URL.createObjectURL(new Blob([buffer], { type: 'audio/wav' }));
    return keepAliveUrl;
}

function ensureHtmlAudio() {
    if (htmlAudio) return htmlAudio;
    htmlAudio = document.createElement('audio');
    htmlAudio.src = ensureKeepAliveUrl();
    htmlAudio.loop = true;
    htmlAudio.preload = 'auto';
    htmlAudio.setAttribute('playsinline', '');
    htmlAudio.setAttribute('webkit-playsinline', '');
    htmlAudio.setAttribute('aria-hidden', 'true');
    htmlAudio.className = 'keepalive';
    document.body.appendChild(htmlAudio);
    return htmlAudio;
}

function kickHtmlAudio() {
    const audio = ensureHtmlAudio();
    const pending = audio.play();
    if (pending) pending.catch(() => {});
}

function getContext() {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) throw new Error('no-audio');
    if (!audioCtx || audioCtx.state === 'closed') {
        try {
            audioCtx = new AC({ latencyHint: 'interactive' });
        } catch (e) {
            audioCtx = new AC();
        }
        workletNode = null;
        audioMode = null;
        armPromise = null;
        chimeBuffer = null;
        fallbackGain = null;
        noiseSource = null;
    }
    return audioCtx;
}

function unlockContext(ctx) {
    const length = Math.max(1, Math.floor(ctx.sampleRate * 0.6));
    const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < length; i++) data[i] = ((i * 17) % 2 === 0 ? 1 : -1) * 0.00005;
    const src = ctx.createBufferSource();
    src.buffer = buffer;
    src.connect(ctx.destination);
    unlockSource = src;
    src.onended = () => {
        if (unlockSource === src) unlockSource = null;
    };
    src.start();
    return ctx.resume();
}

function createWorkletNode(ctx) {
    const options = { numberOfInputs: 0, numberOfOutputs: 1, outputChannelCount: [2] };
    try {
        return new AudioWorkletNode(ctx, 'chime-processor', options);
    } catch (e) {
        return new AudioWorkletNode(ctx, 'chime-processor');
    }
}

function armSound(ctx) {
    if (audioMode === 'worklet' && workletNode && workletNode.context === ctx) return Promise.resolve();
    if (audioMode === 'fallback' && chimeBuffer && audioCtx === ctx) return Promise.resolve();
    if (!armPromise) {
        armPromise = setupSound(ctx).catch((error) => {
            armPromise = null;
            throw error;
        });
    }
    return armPromise;
}

async function setupSound(ctx) {
    if (ctx.audioWorklet) {
        try {
            await ctx.audioWorklet.addModule('hydratation-worklet.js?v=' + ASSET_VERSION);
            const created = createWorkletNode(ctx);
            created.connect(ctx.destination);
            workletNode = created;
            audioMode = 'worklet';
            app.dataset.engine = 'worklet';
            return;
        } catch (e) {
            workletNode = null;
        }
    }
    buildFallback(ctx);
    audioMode = 'fallback';
    app.dataset.engine = 'fallback';
}

function buildFallback(ctx) {
    const length = Math.floor(ctx.sampleRate * 2.6);
    chimeBuffer = ctx.createBuffer(1, length, ctx.sampleRate);
    const data = chimeBuffer.getChannelData(0);
    for (let i = 0; i < length; i++) data[i] = chimeSample(i / ctx.sampleRate);
    fallbackGain = ctx.createGain();
    fallbackGain.gain.value = currentGain();
    fallbackGain.connect(ctx.destination);
}

function applyVolume() {
    const gain = currentGain();
    if (workletNode) {
        try {
            workletNode.port.postMessage({ type: 'gain', gain: gain });
        } catch (e) {}
    }
    if (fallbackGain && audioCtx) {
        try {
            fallbackGain.gain.setTargetAtTime(gain, audioCtx.currentTime, 0.03);
        } catch (e) {
            fallbackGain.gain.value = gain;
        }
    }
}

function startNoise(ctx) {
    if (noiseSource) return;
    const length = Math.floor(ctx.sampleRate);
    const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    let seed = 0x1234567;
    for (let i = 0; i < length; i++) {
        seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
        data[i] = ((seed / 4294967296) * 2 - 1) * 0.00015;
    }
    const src = ctx.createBufferSource();
    src.buffer = buffer;
    src.loop = true;
    src.connect(ctx.destination);
    src.start();
    noiseSource = src;
}

function stopNoise() {
    if (!noiseSource) return;
    try { noiseSource.stop(); } catch (e) {}
    try { noiseSource.disconnect(); } catch (e) {}
    noiseSource = null;
}

function stopFallbackSources() {
    fallbackSources.forEach((item) => {
        try { item.source.stop(); } catch (e) {}
    });
    fallbackSources = [];
    if (fallbackTimer) {
        clearInterval(fallbackTimer);
        fallbackTimer = 0;
    }
}

function playFallbackNow() {
    if (!audioCtx || !chimeBuffer || !fallbackGain) return;
    const src = audioCtx.createBufferSource();
    src.buffer = chimeBuffer;
    src.connect(fallbackGain);
    src.start();
    fallbackSources.push({ source: src, n: -1 });
}

function scheduleFallbackAhead() {
    if (!audioCtx || !chimeBuffer || !fallbackGain || !running) return;
    const intervalSec = minutes * 60;
    const elapsedSec = Math.max(0, (Date.now() - wallStart) / 1000);
    let n = Math.floor(elapsedSec / intervalSec) + 1;
    const horizon = audioCtx.currentTime + HORIZON_SEC;
    const planned = new Set(fallbackSources.map((item) => item.n));

    while (n < 100000) {
        const wallAt = wallStart + n * intervalSec * 1000;
        const when = audioCtx.currentTime + (wallAt - Date.now()) / 1000;
        if (when > horizon) break;
        if (when > audioCtx.currentTime + 0.08 && !planned.has(n)) {
            const src = audioCtx.createBufferSource();
            src.buffer = chimeBuffer;
            src.connect(fallbackGain);
            src.start(when);
            fallbackSources.push({ source: src, n: n });
            planned.add(n);
        }
        n += 1;
    }
}

function startFallback() {
    stopFallbackSources();
    startNoise(audioCtx);
    scheduleFallbackAhead();
    fallbackTimer = setInterval(scheduleFallbackAhead, 10000);
}

function beginEngine() {
    const intervalMs = minutes * 60 * 1000;
    const remainingMs = remainingFromElapsed(Date.now() - wallStart, intervalMs);
    const samples = Math.round((intervalMs / 1000) * audioCtx.sampleRate);
    if (audioMode === 'worklet' && workletNode) {
        workletNode.port.postMessage({
            type: 'start',
            intervalSamples: samples,
            firstDelaySamples: Math.max(1, Math.round((remainingMs / 1000) * audioCtx.sampleRate)),
            gain: currentGain()
        });
        return;
    }
    startFallback();
}

function maybeResync(force) {
    if (!running || !soundLive || !audioCtx || !audioMark) return;
    const nowPerf = performance.now();
    if (!force && nowPerf - lastLagCheck < 2000) return;
    lastLagCheck = nowPerf;
    if (document.visibilityState === 'hidden' && !force) return;

    if (audioCtx.state === 'suspended') audioCtx.resume().catch(() => {});
    if (htmlAudio && htmlAudio.paused) {
        const pending = htmlAudio.play();
        if (pending) pending.catch(() => {});
    }

    const lag = (Date.now() - audioMark.wall) / 1000 - (audioCtx.currentTime - audioMark.ctx);
    if (Math.abs(lag) < 2) return;

    const intervalMs = minutes * 60 * 1000;
    const elapsed = Date.now() - wallStart;
    const mod = ((elapsed % intervalMs) + intervalMs) % intervalMs;
    let playNow = lag > 2 && elapsed >= intervalMs && mod < 3000;
    if (playNow && Date.now() - lastMakeupAt < 8000) playNow = false;
    if (playNow) lastMakeupAt = Date.now();

    if (audioMode === 'worklet' && workletNode) {
        const remaining = mod === 0 ? intervalMs : intervalMs - mod;
        workletNode.port.postMessage({
            type: 'resync',
            samplesUntil: Math.max(1, Math.round((remaining / 1000) * audioCtx.sampleRate)),
            playNow: playNow
        });
    } else if (audioMode === 'fallback') {
        stopFallbackSources();
        scheduleFallbackAhead();
        fallbackTimer = setInterval(scheduleFallbackAhead, 10000);
        if (playNow) playFallbackNow();
    }

    audioMark = { ctx: audioCtx.currentTime, wall: Date.now() };
}

async function recoverNow() {
    if (!running || recovering) return;
    recovering = true;
    try {
        if (audioCtx && soundLive) {
            try { await audioCtx.resume(); } catch (e) {}
        }
        if (!running) return;
        lastLagCheck = 0;
        maybeResync(true);
        requestWakeLock();
        loop();
    } finally {
        recovering = false;
    }
}

function requestWakeLock() {
    if (!navigator.wakeLock || document.visibilityState !== 'visible') return;
    navigator.wakeLock.request('screen').then((lock) => {
        wakeLock = lock;
    }).catch(() => {});
}

function releaseWakeLock() {
    if (!wakeLock) return;
    wakeLock.release().catch(() => {});
    wakeLock = null;
}

function setMediaSession() {
    if (!('mediaSession' in navigator)) return;
    try {
        navigator.mediaSession.metadata = new MediaMetadata({
            title: 'Rappel hydratation',
            artist: "Un verre d'eau",
            album: 'Récupération en cours'
        });
        navigator.mediaSession.playbackState = 'playing';
        navigator.mediaSession.setActionHandler('pause', () => stopSession());
        navigator.mediaSession.setActionHandler('stop', () => stopSession());
    } catch (e) {}
}

function clearMediaSession() {
    if (!('mediaSession' in navigator)) return;
    try {
        navigator.mediaSession.playbackState = 'none';
        navigator.mediaSession.setActionHandler('pause', null);
        navigator.mediaSession.setActionHandler('stop', null);
    } catch (e) {}
}

function quietAudio() {
    if (workletNode) {
        try { workletNode.port.postMessage({ type: 'stop' }); } catch (e) {}
    }
    stopFallbackSources();
    stopNoise();
    if (htmlAudio) {
        try { htmlAudio.pause(); } catch (e) {}
        try { htmlAudio.currentTime = 0; } catch (e) {}
    }
    if (audioCtx && audioCtx.state === 'running') {
        audioCtx.suspend().catch(() => {});
    }
    releaseWakeLock();
    clearMediaSession();
    setAudioSession('auto');
}

function stopSession(options) {
    const silent = options && options.silent;
    const fromRemote = options && options.fromRemote;
    if (!running && !arming && silent) {
        quietAudio();
        return;
    }
    if (!running && !arming) return;
    runToken += 1;
    previewToken += 1;
    soundToken += 1;
    running = false;
    arming = false;
    soundLive = false;
    wallStart = 0;
    announcedAlarm = 0;
    audioMark = null;
    clearTimeout(previewTimer);
    stopLoop();
    quietAudio();
    render();
    document.title = 'Hydratation';
    if (!silent) announce('Rappel arrêté.');
    if (!fromRemote) publishState();
}

function wait(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

// Prépare le son. Hors geste utilisateur (iPhone surtout), resume() peut
// rester en attente indéfiniment : on borne l'attente et on vérifie l'état.
async function armAudio(alive) {
    setAudioSession('playback');
    const ctx = getContext();
    unlockContext(ctx);
    kickHtmlAudio();
    await Promise.race([ctx.resume().catch(() => {}), wait(1500)]);
    if (!alive()) return null;
    if (ctx.state !== 'running') throw new Error('suspended');
    await armSound(ctx);
    if (!alive()) return null;
    if (ctx.state !== 'running') throw new Error('suspended');
    return ctx;
}

function attachEngine(ctx) {
    audioMark = { ctx: ctx.currentTime, wall: Date.now() };
    applyVolume();
    beginEngine();
    setMediaSession();
    requestWakeLock();
    soundLive = true;
    lastLagCheck = 0;
    render();
}

async function startSession() {
    if (running || arming) return;
    if (!inputValid || !Number.isInteger(minutes)) return;
    previewToken += 1;
    clearTimeout(previewTimer);
    clearTimeout(intervalPublishTimer);
    clearError();
    statusNote = '';
    arming = true;
    const token = ++runToken;
    render();

    try {
        const ctx = await armAudio(() => token === runToken);
        if (!ctx) return;

        running = true;
        arming = false;
        wallStart = Date.now();
        announcedAlarm = 0;
        attachEngine(ctx);
        announce('Rappel lancé. Prochain verre dans ' + minutes + (minutes > 1 ? ' minutes.' : ' minute.'));
        loop();
        publishState();
    } catch (e) {
        if (token !== runToken) return;
        running = false;
        arming = false;
        wallStart = 0;
        quietAudio();
        render();
        showError("Le son n'a pas pu démarrer. Appuyez à nouveau pour réessayer.");
    }
}

// ======================================
// LIEN ENTRE APPAREILS
// ======================================

function publishState() {
    if (!sync || !sync.isLinked()) return;
    sync.publish({ running: running, start: running ? wallStart : 0, interval: minutes });
}

// Reçu du relais : état d'un autre appareil, déjà déchiffré et validé.
function adoptRemote(state) {
    clearError();
    if (!state.running) {
        if (running || arming) {
            stopSession({ fromRemote: true, silent: true });
            statusNote = "Arrêté depuis l'autre appareil";
            announce("Rappel arrêté depuis l'autre appareil.");
        }
        if (!running && state.interval !== minutes) {
            inputValid = true;
            setMinutes(state.interval, false, true);
        }
        render();
        return;
    }

    if (running && wallStart === state.start && minutes === state.interval) return;

    const keepSound = running && soundLive && audioCtx && audioCtx.state === 'running';
    runToken += 1;
    previewToken += 1;
    clearTimeout(previewTimer);
    clearTimeout(intervalPublishTimer);
    inputValid = true;
    statusNote = '';
    minutes = state.interval;
    store(MINUTES_KEY, minutes);
    minutesInput.value = String(minutes);
    arming = false;
    running = true;
    wallStart = state.start;
    announcedAlarm = elapsedAlarms(Date.now() - wallStart, minutes * 60 * 1000);

    if (keepSound) {
        attachEngine(audioCtx);
    } else {
        soundLive = false;
        audioMark = null;
        tryAutoSound();
    }
    render();
    loop();
    announce("Rappel repris depuis l'autre appareil.");
}

// Essaie de démarrer le son sans geste (fonctionne sur PC après une première
// interaction) ; sinon affiche le bouton « Activer le son ».
async function tryAutoSound() {
    const token = ++soundToken;
    const alive = () => token === soundToken && running && !soundLive;
    try {
        const ctx = await armAudio(alive);
        if (ctx) attachEngine(ctx);
    } catch (e) {
        if (alive()) render();
    }
}

async function gateTap() {
    if (!running || soundLive) {
        render();
        return;
    }
    clearError();
    const token = ++soundToken;
    const alive = () => token === soundToken && running && !soundLive;
    soundGate.disabled = true;
    try {
        const ctx = await armAudio(alive);
        if (ctx) {
            attachEngine(ctx);
            announce('Son activé sur cet appareil.');
        }
    } catch (e) {
        if (alive()) showError("Le son n'a pas pu démarrer. Appuyez à nouveau.");
    } finally {
        soundGate.disabled = false;
    }
}

function drawQr(url) {
    if (typeof qrcode !== 'function' || !url) return;
    const qr = qrcode(0, 'M');
    qr.addData(url);
    qr.make();
    const count = qr.getModuleCount();
    const quiet = 2;
    const scale = 8;
    const size = (count + quiet * 2) * scale;
    shareQr.width = size;
    shareQr.height = size;
    const ctx = shareQr.getContext('2d');
    ctx.fillStyle = '#fbfdfc';
    ctx.fillRect(0, 0, size, size);
    ctx.fillStyle = '#0b2a31';
    for (let r = 0; r < count; r++) {
        for (let c = 0; c < count; c++) {
            if (qr.isDark(r, c)) ctx.fillRect((c + quiet) * scale, (r + quiet) * scale, scale, scale);
        }
    }
}

function syncLabel(status) {
    switch (status) {
        case 'connected': return 'Synchronisé';
        case 'connecting':
        case 'reconnecting': return 'Connexion au relais…';
        case 'error': return 'Relais injoignable — le rappel continue ici';
        case 'refused': return 'Écriture refusée par le relais';
        case 'unsupported': return 'Navigateur ou connexion non compatible';
        default: return '';
    }
}

function updateShareUi() {
    const linked = Boolean(sync && sync.isLinked());
    const status = sync ? sync.status() : 'off';
    shareToggle.classList.toggle('is-linked', linked);
    setText(shareToggleText, linked ? 'Appareils liés' : 'Continuer sur un autre appareil');
    shareDot.hidden = !linked;
    shareDot.classList.toggle('is-warn', linked && status !== 'connected');
    setText(shareSync, linked ? syncLabel(status) : '');
    shareUnlink.hidden = !linked;
    shareNative.hidden = !(linked && typeof navigator.share === 'function');
}

async function toggleShare() {
    const expanded = shareToggle.getAttribute('aria-expanded') === 'true';
    if (expanded) {
        sharePanel.hidden = true;
        shareToggle.setAttribute('aria-expanded', 'false');
        return;
    }
    if (!sync) return;
    clearError();
    if (!sync.isLinked()) {
        shareToggle.disabled = true;
        let url = null;
        try {
            url = await sync.link();
        } finally {
            shareToggle.disabled = false;
        }
        if (!url) {
            showError('Le lien entre appareils demande une connexion sécurisée (https) et un navigateur récent.');
            updateShareUi();
            return;
        }
        publishState();
    }
    drawQr(sync.url());
    sharePanel.hidden = false;
    shareToggle.setAttribute('aria-expanded', 'true');
    updateShareUi();
}

async function copyLink() {
    const url = sync && sync.url();
    if (!url) return;
    let ok = false;
    try {
        if (navigator.clipboard && navigator.clipboard.writeText) {
            await navigator.clipboard.writeText(url);
            ok = true;
        }
    } catch (e) {
        ok = false;
    }
    if (!ok) {
        window.prompt('Copiez ce lien :', url);
        return;
    }
    clearTimeout(copyTimer);
    setText(shareCopy, 'Lien copié');
    copyTimer = setTimeout(() => setText(shareCopy, 'Copier le lien'), 1800);
}

async function shareLink() {
    const url = sync && sync.url();
    if (!url || typeof navigator.share !== 'function') return;
    try {
        await navigator.share({ title: 'Hydratation — reprendre le rappel', url: url });
    } catch (e) {}
}

function unlinkDevice() {
    if (!sync) return;
    sync.unlink();
    sharePanel.hidden = true;
    shareToggle.setAttribute('aria-expanded', 'false');
    statusNote = '';
    updateShareUi();
    render();
    announce('Appareil détaché. Le rappel continue ici seulement.');
}

function initSync() {
    if (!window.HydraSync) return;
    sync = window.HydraSync.create({
        onState: adoptRemote,
        onStatus: updateShareUi
    });
    sync.boot().then((linked) => {
        updateShareUi();
        if (linked) announce('Appareil lié. En attente de l\'état du rappel…');
    }).catch(() => updateShareUi());
}

async function preview() {
    if (arming) return;
    clearError();
    const token = ++previewToken;
    clearTimeout(previewTimer);
    try {
        setAudioSession('playback');
        const ctx = getContext();
        unlockContext(ctx);
        await ctx.resume();
        if (token !== previewToken) return;
        await armSound(ctx);
        if (token !== previewToken) return;
        applyVolume();
        if (audioMode === 'worklet' && workletNode) {
            workletNode.port.postMessage({ type: 'preview', gain: currentGain() });
        } else {
            playFallbackNow();
        }
        announce("Aperçu de l'alarme.");
        if (!running) {
            previewTimer = setTimeout(() => {
                if (!running && !arming) {
                    if (audioCtx && audioCtx.state === 'running') audioCtx.suspend().catch(() => {});
                    setAudioSession('auto');
                }
            }, 3200);
        }
    } catch (e) {
        if (token !== previewToken) return;
        showError("Le son n'a pas pu démarrer. Appuyez à nouveau pour réessayer.");
    }
}

function bind() {
    presetButtons.forEach((button) => {
        button.addEventListener('click', () => {
            if (running || arming) return;
            const next = parseMinutes(button.dataset.minutes);
            if (next == null) return;
            inputValid = true;
            setMinutes(next, false);
        });
    });

    minusBtn.addEventListener('click', () => changeMinutes(-1));
    plusBtn.addEventListener('click', () => changeMinutes(1));

    minutesInput.addEventListener('focus', () => {
        if (!minutesInput.readOnly) minutesInput.select();
    });

    minutesInput.addEventListener('input', () => {
        const parsed = parseMinutes(minutesInput.value);
        if (parsed == null) {
            inputValid = false;
            syncControls();
            return;
        }
        inputValid = true;
        setMinutes(parsed, true);
    });

    minutesInput.addEventListener('blur', () => {
        inputValid = true;
        minutesInput.value = String(minutes);
        syncControls();
    });

    minutesInput.addEventListener('keydown', (event) => {
        if (event.key !== 'Enter') return;
        event.preventDefault();
        minutesInput.blur();
        if (!running && !arming && inputValid) startSession();
    });

    toggleBtn.addEventListener('click', () => {
        if (running || arming) stopSession();
        else startSession();
    });

    previewBtn.addEventListener('click', preview);
    soundGate.addEventListener('click', gateTap);
    shareToggle.addEventListener('click', toggleShare);
    shareCopy.addEventListener('click', copyLink);
    shareNative.addEventListener('click', shareLink);
    shareUnlink.addEventListener('click', unlinkDevice);

    volumeInput.addEventListener('input', () => {
        volume = Number(volumeInput.value);
        if (!Number.isInteger(volume)) volume = 50;
        store(VOLUME_KEY, volume);
        applyVolume();
    });

    document.addEventListener('keydown', (event) => {
        if (event.key === 'Escape' && (running || arming)) stopSession();
    });

    // pagehide et visibility hidden sont envoyés quand l'écran se verrouille.
    // Le son doit continuer : on ne coupe rien ici.
    document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') recoverNow();
    });

    window.addEventListener('focus', () => {
        if (document.visibilityState === 'visible') recoverNow();
    });

    document.addEventListener('resume', () => recoverNow());

    window.addEventListener('pageshow', (event) => {
        if (!event.persisted) return;
        stopSession({ silent: true, fromRemote: true });
        audioCtx = null;
        workletNode = null;
        audioMode = null;
        armPromise = null;
        noiseSource = null;
        showError('Le rappel a été interrompu. Appuyez pour le relancer.');
        if (sync && sync.isLinked()) sync.refresh();
    });
}

function init() {
    minutes = readStored(MINUTES_KEY, 15, MIN_MINUTES, MAX_MINUTES);
    volume = readStored(VOLUME_KEY, 50, 0, 100);
    minutesInput.value = String(minutes);
    volumeInput.value = String(volume);
    ring.style.strokeDasharray = String(RING_C);
    ring.style.strokeDashoffset = '0';
    bind();
    render();
    updateShareUi();
    initSync();
}

init();
