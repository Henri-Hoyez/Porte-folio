// Thread audio : continue quand iOS suspend le JavaScript (Safari, écran verrouillé).
// Le bruit de fond est inaudible et empêche le contexte d'être coupé pour « silence ».

class ChimeProcessor extends AudioWorkletProcessor {
    constructor() {
        super();
        this.running = false;
        this.interval = 0;
        this.until = 0;
        this.pos = -1;
        this.gain = 0.45;
        this.gainCurrent = 0.45;
        this.seed = 0x6d2b79f5;
        this.chimeSamples = Math.floor(sampleRate * 2.6);
        this.port.onmessage = (event) => this.onMessage(event.data || {});
    }

    onMessage(msg) {
        if (msg.type === "start") {
            this.running = true;
            this.interval = Math.max(1, msg.intervalSamples || 1);
            this.until = Math.max(1, msg.firstDelaySamples || this.interval);
            this.gain = clampGain(msg.gain);
            this.gainCurrent = this.gain;
            this.pos = -1;
        } else if (msg.type === "stop") {
            this.running = false;
            this.pos = -1;
        } else if (msg.type === "gain") {
            this.gain = clampGain(msg.gain);
        } else if (msg.type === "preview") {
            this.gain = clampGain(msg.gain);
            this.pos = 0;
        } else if (msg.type === "resync" && this.running) {
            this.until = Math.max(1, msg.samplesUntil || this.interval);
            if (msg.playNow && this.pos < 0) this.pos = 0;
        }
    }

    nextNoise() {
        let x = this.seed | 0;
        x ^= x << 13;
        x ^= x >> 17;
        x ^= x << 5;
        this.seed = x;
        return ((x >>> 0) / 4294967296) * 2 - 1;
    }

    chimeSample(t) {
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

    process(inputs, outputs) {
        const channels = outputs[0];
        if (!channels || !channels[0]) return true;
        const n = channels[0].length;
        const count = channels.length;

        for (let i = 0; i < n; i++) {
            let s = 0;
            if (this.running) {
                s = this.nextNoise() * 0.00012;
                this.until -= 1;
                if (this.until <= 0) {
                    this.until = this.interval;
                    this.pos = 0;
                }
            }
            if (this.pos >= 0) {
                this.gainCurrent += (this.gain - this.gainCurrent) * 0.01;
                s += this.chimeSample(this.pos / sampleRate) * this.gainCurrent;
                this.pos += 1;
                if (this.pos >= this.chimeSamples) this.pos = -1;
            }
            for (let c = 0; c < count; c++) channels[c][i] = s;
        }
        return true;
    }
}

function clampGain(value) {
    const n = Number(value);
    if (!Number.isFinite(n)) return 0.45;
    if (n < 0) return 0;
    if (n > 1) return 1;
    return n;
}

registerProcessor("chime-processor", ChimeProcessor);
