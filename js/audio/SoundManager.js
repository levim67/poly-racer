/**
 * Sound Manager
 * Handles synthesized sound effects using Web Audio API
 */
export class SoundManager {
    constructor() {
        this.ctx = null;
        this.masterGain = null;
        this.enabled = false;

        // Engine sound
        this.engineOsc = null;
        this.engineGain = null;
        this.engineLFO = null;

        // Drift sound
        this.driftNode = null;
        this.driftGain = null;

        // Init on first user interaction
        this.init();
    }

    init() {
        try {
            const AudioContext = window.AudioContext || window.webkitAudioContext;
            this.ctx = new AudioContext();
            this.masterGain = this.ctx.createGain();
            this.masterGain.gain.value = 0.5;
            this.masterGain.connect(this.ctx.destination);
            this.enabled = true;
        } catch (e) {
            console.warn('Web Audio API not supported');
            this.enabled = false;
        }

        // Resume context on click/key (browser policy)
        const resume = () => {
            if (this.ctx && this.ctx.state === 'suspended') {
                this.ctx.resume();
            }
            window.removeEventListener('keydown', resume);
            window.removeEventListener('mousedown', resume);
            window.removeEventListener('touchstart', resume);
        };

        window.addEventListener('keydown', resume);
        window.addEventListener('mousedown', resume);
        window.addEventListener('touchstart', resume);
    }

    startEngine() {
        if (!this.enabled || this.engineOsc) return;

        // Engine oscillator (Sawtooth for rough engine sound)
        this.engineOsc = this.ctx.createOscillator();
        this.engineOsc.type = 'sawtooth';
        this.engineOsc.frequency.value = 100;

        // Engine gain
        this.engineGain = this.ctx.createGain();
        this.engineGain.gain.value = 0.1;

        // Connect
        this.engineOsc.connect(this.engineGain);
        this.engineGain.connect(this.masterGain);

        this.engineOsc.start();
    }

    updateEngine(rpm) {
        // rpm is 0 to 1
        if (!this.enabled || !this.engineOsc) return;

        const baseFreq = 80;
        const maxFreq = 300;

        // Target frequency
        const targetFreq = baseFreq + (maxFreq - baseFreq) * rpm;

        // Smooth transition
        this.engineOsc.frequency.setTargetAtTime(targetFreq, this.ctx.currentTime, 0.1);

        // Volume wobble based on RPM (rumble)
        // this.engineGain.gain.value = 0.1 + (0.05 * Math.random());
    }

    startDrift() {
        if (!this.enabled) return;
        if (this.driftGain) {
            this.driftGain.gain.setTargetAtTime(0.2, this.ctx.currentTime, 0.1);
            return;
        }

        // Create noise buffer
        const bufferSize = this.ctx.sampleRate * 2; // 2 seconds
        const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
        const data = buffer.getChannelData(0);

        for (let i = 0; i < bufferSize; i++) {
            data[i] = Math.random() * 2 - 1;
        }

        // Create source
        const noise = this.ctx.createBufferSource();
        noise.buffer = buffer;
        noise.loop = true;

        // Filter (Lowpass)
        const filter = this.ctx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.value = 800;

        // Gain
        const gain = this.ctx.createGain();
        gain.gain.value = 0; // Start silent

        // Connect
        noise.connect(filter);
        filter.connect(gain);
        gain.connect(this.masterGain);

        noise.start();

        this.driftNode = noise;
        this.driftGain = gain;

        // Fade in
        gain.gain.setTargetAtTime(0.2, this.ctx.currentTime, 0.1);
    }

    stopDrift() {
        if (!this.enabled || !this.driftGain) return;

        // Fade out
        this.driftGain.gain.setTargetAtTime(0, this.ctx.currentTime, 0.1);
    }

    playTone(freq, type, duration, vol = 0.1) {
        if (!this.enabled) return;

        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();

        osc.type = type;
        osc.frequency.setValueAtTime(freq, this.ctx.currentTime);

        gain.gain.setValueAtTime(vol, this.ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + duration);

        osc.connect(gain);
        gain.connect(this.masterGain);

        osc.start();
        osc.stop(this.ctx.currentTime + duration);
    }

    playCheckpoint() {
        this.playTone(800, 'sine', 0.1, 0.2);
        setTimeout(() => this.playTone(1200, 'sine', 0.2, 0.2), 100);
    }

    playBoost() {
        // Whoosh sound (noise + filter sweep)
        if (!this.enabled) return;

        // Use tone for now
        this.playTone(200, 'square', 0.5, 0.1);
    }

    playCrash() {
        this.playTone(100, 'sawtooth', 0.3, 0.3);
    }
}
