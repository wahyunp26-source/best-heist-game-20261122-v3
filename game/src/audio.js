// VELVET VAULT — all sound is synthesized with WebAudio: no audio files.
// A tiny synth: blips for steps and grabs, a two-tone alarm, a win fanfare.

export class Sfx {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.muted = false;
    this.lastStep = 0;
  }
  ensure() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') this.ctx.resume();
      return;
    }
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.master.gain.value = 0.16;
      this.master.connect(this.ctx.destination);
    } catch (e) {
      this.ctx = null;
    }
  }
  toggleMute() {
    this.muted = !this.muted;
    if (this.master) this.master.gain.value = this.muted ? 0 : 0.16;
    return this.muted;
  }
  tone(freq, dur, type = 'sine', vol = 1, slideTo = null, when = 0) {
    if (!this.ctx || this.muted) return;
    const t0 = this.ctx.currentTime + when;
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, t0);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t0 + dur);
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(0.5 * vol, t0 + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    o.connect(g);
    g.connect(this.master);
    o.start(t0);
    o.stop(t0 + dur + 0.05);
  }
  noise(dur, vol = 0.5, freq = 1200) {
    if (!this.ctx || this.muted) return;
    const t0 = this.ctx.currentTime;
    const len = Math.floor(this.ctx.sampleRate * dur);
    const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    const f = this.ctx.createBiquadFilter();
    f.type = 'bandpass';
    f.frequency.value = freq;
    const g = this.ctx.createGain();
    g.gain.value = vol;
    src.connect(f);
    f.connect(g);
    g.connect(this.master);
    src.start(t0);
  }
  step() {
    const now = performance.now();
    if (now - this.lastStep < 240) return;
    this.lastStep = now;
    this.tone(190, 0.05, 'triangle', 0.25);
  }
  grab() {
    this.tone(660, 0.09, 'sine', 0.8);
    this.tone(880, 0.09, 'sine', 0.8, null, 0.07);
    this.tone(1320, 0.14, 'sine', 0.8, null, 0.14);
  }
  coin() {
    this.tone(1200, 0.08, 'square', 0.3, 500);
    this.noise(0.12, 0.2, 2600);
  }
  smoke() {
    this.noise(0.5, 0.5, 700);
  }
  suspicious() {
    this.tone(520, 0.12, 'square', 0.35, 760);
  }
  alert() {
    this.tone(440, 0.16, 'sawtooth', 0.4, 620);
    this.tone(620, 0.16, 'sawtooth', 0.4, 440, 0.16);
  }
  zap() {
    this.tone(1800, 0.1, 'sawtooth', 0.5, 300);
    this.noise(0.08, 0.4, 3200);
  }
  caught() {
    this.tone(320, 0.5, 'sawtooth', 0.6, 90);
    this.tone(160, 0.6, 'square', 0.4, 60, 0.1);
  }
  levelClear() {
    [523, 659, 784, 1047].forEach((f, i) => this.tone(f, 0.16, 'sine', 0.7, null, i * 0.09));
  }
  win() {
    [523, 659, 784, 1047, 784, 1047, 1319].forEach((f, i) =>
      this.tone(f, 0.2, 'triangle', 0.7, null, i * 0.11));
  }
}
