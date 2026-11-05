// Tiny procedural sound engine (no external assets needed for the prototype).
export class Audio {
  private ctx: AudioContext | null = null;
  private noise: AudioBuffer | null = null;
  volume = 0.6;

  /** Must be called from a user gesture. */
  unlock(): void {
    if (!this.ctx) {
      this.ctx = new AudioContext();
      const len = Math.floor(this.ctx.sampleRate * 0.4);
      this.noise = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
      const d = this.noise.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    }
    if (this.ctx.state === 'suspended') void this.ctx.resume();
  }

  rustle(intensity = 1): void {
    const ctx = this.ctx;
    if (!ctx || !this.noise) return;
    const src = ctx.createBufferSource();
    src.buffer = this.noise;
    src.playbackRate.value = 0.8 + Math.random() * 0.5;
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = 1800 + Math.random() * 2200;
    bp.Q.value = 0.7;
    const g = ctx.createGain();
    const t = ctx.currentTime;
    const dur = 0.12 + 0.1 * intensity;
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(0.35 * this.volume * Math.min(1.5, intensity), t + 0.015);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    src.connect(bp).connect(g).connect(ctx.destination);
    src.start(t, Math.random() * 0.2, dur + 0.05);
  }

  coin(): void {
    const ctx = this.ctx;
    if (!ctx) return;
    const t = ctx.currentTime;
    [988, 1319].forEach((f, i) => {
      const o = ctx.createOscillator();
      o.type = 'triangle';
      o.frequency.value = f;
      const g = ctx.createGain();
      const s = t + i * 0.07;
      g.gain.setValueAtTime(0, s);
      g.gain.linearRampToValueAtTime(0.18 * this.volume, s + 0.01);
      g.gain.exponentialRampToValueAtTime(0.001, s + 0.35);
      o.connect(g).connect(ctx.destination);
      o.start(s);
      o.stop(s + 0.4);
    });
  }

  private tone(freq: number, start: number, dur: number, gain: number, type: OscillatorType = 'triangle', endFreq?: number): void {
    const ctx = this.ctx!;
    const o = ctx.createOscillator();
    o.type = type;
    o.frequency.setValueAtTime(freq, start);
    if (endFreq) o.frequency.exponentialRampToValueAtTime(endFreq, start + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, start);
    g.gain.linearRampToValueAtTime(gain * this.volume, start + 0.008);
    g.gain.exponentialRampToValueAtTime(0.001, start + dur);
    o.connect(g).connect(ctx.destination);
    o.start(start);
    o.stop(start + dur + 0.05);
  }

  private click(start: number, freq: number, gain: number, dur = 0.035): void {
    const ctx = this.ctx!;
    const src = ctx.createBufferSource();
    src.buffer = this.noise;
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = freq;
    bp.Q.value = 1.2;
    const g = ctx.createGain();
    g.gain.setValueAtTime(gain * this.volume, start);
    g.gain.exponentialRampToValueAtTime(0.001, start + dur);
    src.connect(bp).connect(g).connect(ctx.destination);
    src.start(start, Math.random() * 0.2, dur + 0.02);
  }

  /** Dull bump: hands are full. */
  thud(): void {
    if (!this.ctx || !this.noise) return;
    const t = this.ctx.currentTime;
    this.tone(150, t, 0.16, 0.35, 'sine', 60);
    this.click(t, 400, 0.25, 0.08);
  }

  /** Soft wooden click when switching tools or pressing UI buttons. */
  tick(): void {
    if (!this.ctx || !this.noise) return;
    this.click(this.ctx.currentTime, 1500, 0.22);
  }

  /** Purchase: a drawer clack and a rising chime. */
  purchase(): void {
    if (!this.ctx || !this.noise) return;
    const t = this.ctx.currentTime;
    this.click(t, 2600, 0.3, 0.05);
    [784, 1175, 1568].forEach((f, i) => this.tone(f, t + 0.05 + i * 0.06, 0.4, 0.16));
  }

  /** Sale chime; bigger sales ring a little longer. */
  sale(size: number): void {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const notes = size > 0.6 ? [988, 1319, 1760] : [988, 1319];
    notes.forEach((f, i) => this.tone(f, t + i * 0.07, 0.35, 0.18));
  }
}
