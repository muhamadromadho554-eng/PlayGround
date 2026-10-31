/* Tiny procedural WebAudio sound engine. No audio files, no autoplay. */

import { clamp } from "./util.js";

export class SoundEngine {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.noiseBuffer = null;
    this.muted = false;
    this.ambient = null;
    this.last = {};
  }

  init() {
    if (this.ctx) {
      if (this.ctx.state === "suspended") this.ctx.resume().catch(() => {});
      return;
    }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    try {
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.master.gain.value = this.muted ? 0 : 0.5;
      this.master.connect(this.ctx.destination);
      const len = Math.floor(this.ctx.sampleRate * 1.5);
      const buffer = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
      this.noiseBuffer = buffer;
    } catch (e) {
      this.ctx = null;
    }
  }

  get on() {
    return !this.muted;
  }

  setMuted(value) {
    this.muted = Boolean(value);
    if (this.master && this.ctx) {
      const t = this.ctx.currentTime;
      this.master.gain.cancelScheduledValues(t);
      this.master.gain.setTargetAtTime(this.muted ? 0 : 0.5, t, 0.03);
    }
  }

  toggle() {
    this.setMuted(!this.muted);
    return !this.muted;
  }

  _ok(name, gap = 0) {
    if (!this.ctx || this.muted) return false;
    const now = performance.now();
    if (gap && this.last[name] && now - this.last[name] < gap) return false;
    this.last[name] = now;
    return true;
  }

  _noise(t, duration, gain, type, freq, freqEnd) {
    const ctx = this.ctx;
    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuffer;
    const filter = ctx.createBiquadFilter();
    filter.type = type || "lowpass";
    filter.frequency.setValueAtTime(freq || 1200, t);
    if (freqEnd) filter.frequency.exponentialRampToValueAtTime(Math.max(40, freqEnd), t + duration);
    const g = ctx.createGain();
    g.gain.setValueAtTime(gain, t);
    g.gain.exponentialRampToValueAtTime(0.0008, t + duration);
    src.connect(filter).connect(g).connect(this.master);
    src.start(t);
    src.stop(t + duration + 0.02);
  }

  _tone(t, type, f0, f1, duration, gain) {
    const ctx = this.ctx;
    const o = ctx.createOscillator();
    o.type = type;
    o.frequency.setValueAtTime(f0, t);
    o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + duration);
    const g = ctx.createGain();
    g.gain.setValueAtTime(gain, t);
    g.gain.exponentialRampToValueAtTime(0.0008, t + duration);
    o.connect(g).connect(this.master);
    o.start(t);
    o.stop(t + duration + 0.02);
  }

  play(name) {
    if (!this.ctx) return;
    const ctx = this.ctx;
    if (ctx.state === "suspended") ctx.resume().catch(() => {});
    const t = ctx.currentTime;
    switch (name) {
      case "gun":
        if (!this._ok("gun", 35)) return;
        this._noise(t, 0.13, 0.42, "lowpass", 2400, 360);
        this._tone(t, "triangle", 165, 52, 0.11, 0.32);
        break;
      case "reload":
        if (!this._ok("reload", 80)) return;
        this._noise(t, 0.035, 0.16, "highpass", 2200);
        this._noise(t + 0.16, 0.045, 0.2, "highpass", 1400);
        break;
      case "reloadDone":
        this._noise(t, 0.04, 0.16, "highpass", 2600);
        this._tone(t, "square", 620, 480, 0.05, 0.04);
        break;
      case "hit":
        if (!this._ok("hit", 45)) return;
        this._noise(t, 0.06, 0.18, "bandpass", 900, 300);
        break;
      case "kill":
        if (!this._ok("kill", 45)) return;
        this._noise(t, 0.2, 0.34, "lowpass", 900, 140);
        this._tone(t, "sawtooth", 120, 42, 0.18, 0.16);
        break;
      case "hurt":
        if (!this._ok("hurt", 100)) return;
        this._tone(t, "sawtooth", 95, 34, 0.3, 0.32);
        this._noise(t, 0.18, 0.22, "lowpass", 700, 120);
        break;
      case "dash":
        this._noise(t, 0.22, 0.22, "bandpass", 500, 2600);
        this._tone(t, "sine", 220, 520, 0.16, 0.06);
        break;
      case "pickup":
        this._tone(t, "sine", 620, 900, 0.1, 0.1);
        this._tone(t + 0.08, "sine", 940, 1250, 0.12, 0.08);
        break;
      case "wave":
        this._tone(t, "sawtooth", 82, 46, 1.4, 0.16);
        this._tone(t + 0.12, "sine", 124, 62, 1.6, 0.1);
        this._noise(t, 1.1, 0.1, "lowpass", 420, 90);
        break;
      case "gameover":
        this._tone(t, "sawtooth", 180, 42, 1.8, 0.24);
        this._tone(t + 0.1, "sine", 90, 30, 2.2, 0.2);
        this._noise(t, 1.4, 0.16, "lowpass", 800, 80);
        break;
      case "empty":
        if (!this._ok("empty", 200)) return;
        this._noise(t, 0.025, 0.12, "highpass", 3000);
        break;
      case "spit":
        if (!this._ok("spit", 80)) return;
        this._noise(t, 0.14, 0.16, "bandpass", 600, 200);
        break;
      case "brute":
        if (!this._ok("brute", 400)) return;
        this._tone(t, "sawtooth", 70, 38, 0.5, 0.24);
        break;
      default:
        break;
    }
  }

  startAmbient() {
    if (!this.ctx || this.muted || this.ambient) return;
    const ctx = this.ctx;
    const t = ctx.currentTime;
    const out = ctx.createGain();
    out.gain.value = 0;
    out.gain.linearRampToValueAtTime(0.055, t + 2.5);
    out.connect(this.master);

    const low = ctx.createBiquadFilter();
    low.type = "lowpass";
    low.frequency.value = 190;
    low.Q.value = 2.2;
    low.connect(out);

    const a = ctx.createOscillator();
    a.type = "sawtooth";
    a.frequency.value = 41.2;
    const b = ctx.createOscillator();
    b.type = "sine";
    b.frequency.value = 61.7;
    b.detune.value = 6;
    const c = ctx.createOscillator();
    c.type = "triangle";
    c.frequency.value = 82.4;
    const cg = ctx.createGain();
    cg.gain.value = 0.35;
    a.connect(low);
    b.connect(low);
    c.connect(cg).connect(low);
    a.start();
    b.start();
    c.start();

    const wind = ctx.createBufferSource();
    wind.buffer = this.noiseBuffer;
    wind.loop = true;
    const wf = ctx.createBiquadFilter();
    wf.type = "lowpass";
    wf.frequency.value = 380;
    const wg = ctx.createGain();
    wg.gain.value = 0.18;
    wind.connect(wf).connect(wg).connect(out);
    wind.start();

    this.ambient = { out, nodes: [a, b, c, wind] };
  }

  stopAmbient() {
    if (!this.ambient || !this.ctx) return;
    const { out, nodes } = this.ambient;
    const t = this.ctx.currentTime;
    out.gain.cancelScheduledValues(t);
    out.gain.setTargetAtTime(0, t, 0.25);
    const stopAt = t + 1.2;
    nodes.forEach((n) => {
      try {
        n.stop(stopAt);
      } catch (e) {
        /* already stopped */
      }
    });
    this.ambient = null;
  }

  setIntensity(value) {
    if (!this.ambient || !this.ctx) return;
    const t = this.ctx.currentTime;
    this.ambient.out.gain.setTargetAtTime(clamp(value, 0, 1) * 0.075, t, 0.4);
  }
}
