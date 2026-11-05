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
}
