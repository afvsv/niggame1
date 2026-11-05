import { BALANCE } from '../data/balance';

const B = BALANCE.stamina;

/** Running and swinging spend stamina; it refills after a short pause. At zero the player is out of breath. */
export class Stamina {
  value: number;
  /** Out of breath: no sprinting and slower swings until `recoverAt` of the bar is back. */
  exhausted = false;
  private idle = 0;

  constructor(public max: number = B.max) { this.value = max; }

  get frac(): number { return this.max > 0 ? this.value / this.max : 0; }

  spend(n: number): void {
    if (n <= 0) return;
    this.value = Math.max(0, this.value - n);
    this.idle = 0;
    if (this.value <= 0) this.exhausted = true;
  }

  /** `sprinting`: running this frame. A bigger max (an upgrade) adds the difference right away. */
  update(dt: number, max: number, regen: number, sprinting: boolean): void {
    if (max > this.max) this.value += max - this.max;
    this.max = max;
    this.value = Math.min(this.value, max);
    if (sprinting && !this.exhausted) this.spend(B.sprintPerSec * dt);
    else if ((this.idle += dt) >= B.regenDelay) this.value = Math.min(max, this.value + regen * dt);
    if (this.exhausted && this.value >= max * B.recoverAt) this.exhausted = false;
  }
}
