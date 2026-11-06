/** One delivery keeps its original price and whether it came from a container. */
export interface Delivery { n: number; value: number; container: boolean; elapsed: number }
export const BELT_TRAVEL = 2.0;
export const BELT_DROP = 0.65;
export const DELIVERY_TIME = BELT_TRAVEL + BELT_DROP;

/** In-flight deliveries are part of the save: leaving cannot lose or duplicate hay. */
export class Conveyor {
  readonly deliveries: Delivery[] = [];
  add(n: number, value: number, container: boolean): void {
    if (n > 0 && Number.isFinite(n) && Number.isFinite(value) && value >= 0)
      this.deliveries.push({ n, value, container, elapsed: 0 });
  }
  update(dt: number, complete: (delivery: Delivery) => void): void {
    if (!Number.isFinite(dt) || dt <= 0) return;
    for (let i = this.deliveries.length - 1; i >= 0; i--) {
      const d = this.deliveries[i];
      d.elapsed += dt;
      if (d.elapsed >= DELIVERY_TIME) { this.deliveries.splice(i, 1); complete(d); }
    }
  }
  serialize(): Delivery[] { return this.deliveries.map((d) => ({ ...d })); }
  load(input: Delivery[] | undefined): void {
    this.deliveries.length = 0;
    if (!Array.isArray(input)) return;
    for (const d of input) {
      if (!d || !Number.isFinite(d.n) || d.n <= 0 || !Number.isFinite(d.value) || d.value < 0 || !Number.isFinite(d.elapsed)) continue;
      this.deliveries.push({ n: d.n, value: d.value, container: !!d.container, elapsed: Math.max(0, Math.min(DELIVERY_TIME - 0.001, d.elapsed)) });
    }
  }
}
