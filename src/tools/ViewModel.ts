import * as THREE from 'three';
import { ALL_ITEMS, ItemId } from '../data/tools';
import { buildModel, setFill, setLed, toolEnvironment } from './models';

const easeOutCubic = (x: number) => 1 - (1 - x) ** 3;
const easeInCubic = (x: number) => x * x * x;
const easeOutBack = (x: number) => { const c = 1.70158; return 1 + (c + 1) * (x - 1) ** 3 + c * (x - 1) ** 2; };
const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v));

// Rest pose of each held tool in camera space: position and rotation (x, y, z).
// Held slightly right of centre and pointing into the view, like the reference game.
const POSE: Record<ItemId, [number, number, number, number, number, number]> = {
  hands: [0.12, -0.16, -0.46, 0.2, 0.3, 0],
  toy_shovel: [0.15, -0.2, -0.36, 0.12, 0.05, -0.05],
  spade: [0.14, -0.34, -0.26, 0.24, 0.03, -0.04],
  pitchfork: [0.13, -0.36, -0.22, 0.22, 0.02, -0.03],
  // Carried by the handle, tipped towards the eye so the hay inside shows.
  bucket: [0.26, -0.36, -0.66, 0.42, -0.35, 0.06],
  // Pushed by the handles; the tray sits low in front.
  wheelbarrow: [0, -0.98, -1.02, 0.16, 0, 0],
  detector: [0.25, -0.3, -0.36, -0.2, -0.12, -0.04],
};

export interface MoveState { speed: number; onGround: boolean; mouseDX: number; mouseDY: number }

/**
 * The tool in the player's hand. Rendered as a second pass over the world with a
 * cleared depth buffer, so it never clips into the haystack.
 */
export class ViewModel {
  readonly scene = new THREE.Scene();
  readonly camera = new THREE.PerspectiveCamera(60, 1, 0.01, 10);
  private readonly holder = new THREE.Group();
  private readonly models = new Map<ItemId, THREE.Object3D>();
  private current: ItemId;
  private pending: ItemId | null = null;
  private swingT = 1;
  private swingDur = 0.25;
  private switchT = 1;
  /** Bob and sway multiplier ("Steady hands"). */
  steady = 1;
  private bobPhase = 0;
  private bobAmp = 0;
  private swayX = 0;
  private swayY = 0;
  private time = 0;
  /** 0..1 visual camera kick after a swing; the main loop adds it to camera pitch. */
  kick = 0;

  constructor(initial: ItemId, renderer: THREE.WebGLRenderer) {
    this.scene.environment = toolEnvironment(renderer);
    this.scene.environmentIntensity = 0.45;
    this.scene.add(new THREE.HemisphereLight('#fff4dc', '#5a4a33', 1.0));
    const sun = new THREE.DirectionalLight('#fff1d0', 1.3);
    sun.position.set(-1, 2, 1);
    this.scene.add(sun, this.holder);
    for (const t of ALL_ITEMS) {
      const m = buildModel(t.id);
      m.visible = false;
      this.models.set(t.id, m);
      this.holder.add(m);
    }
    this.current = initial;
    this.models.get(initial)!.visible = true;
  }

  setAspect(a: number): void { this.camera.aspect = a; this.camera.updateProjectionMatrix(); }

  setTool(id: ItemId): void {
    if (id === this.current && !this.pending) return;
    this.pending = id;
    this.switchT = 0;
  }

  get switching(): boolean { return this.switchT < 1; }

  /** How full the item in hand is (0..1): straws on the tool, the hay level in a container. */
  setLoad(fill: number): void { setFill(this.models.get(this.pending ?? this.current)!, fill); }

  /** Detector LED. */
  setSignal(strength: number, blink: number): void { setLed(this.models.get('detector')!, strength, blink); }

  swing(duration: number): void {
    this.swingT = 0;
    this.swingDur = clamp(duration * 0.9, 0.16, 0.42);
    this.kick = 1;
  }

  update(dt: number, m: MoveState): void {
    this.time += dt;
    // Swing: quick thrust forward with the tip dipping, then an overshooting return.
    if (this.swingT < 1) this.swingT = Math.min(1, this.swingT + dt / this.swingDur);
    const p = this.swingT;
    const a = p >= 1 ? 0 : p < 0.35 ? easeOutCubic(p / 0.35) : 1 - easeOutBack((p - 0.35) / 0.65);
    this.kick *= Math.exp(-dt * 16);

    // Switch: lower the old tool, swap at the bottom, raise the new one.
    let lower = 0;
    if (this.switchT < 1) {
      this.switchT = Math.min(1, this.switchT + dt / 0.3);
      if (this.switchT >= 0.5 && this.pending) {
        this.models.get(this.current)!.visible = false;
        this.current = this.pending;
        this.pending = null;
        this.models.get(this.current)!.visible = true;
      }
      lower = this.switchT < 0.5 ? easeInCubic(this.switchT / 0.5) : 1 - easeOutBack((this.switchT - 0.5) / 0.5);
    }

    // Walk bob, scaled by horizontal speed.
    const targetAmp = m.onGround ? clamp(m.speed / 4.2, 0, 1.4) : 0.15;
    this.bobAmp += (targetAmp - this.bobAmp) * Math.min(1, dt * 8);
    this.bobPhase += dt * m.speed * 1.5;
    const bx = Math.sin(this.bobPhase) * 0.012 * this.bobAmp * this.steady;
    const by = -Math.abs(Math.cos(this.bobPhase)) * 0.014 * this.bobAmp * this.steady;

    // Sway: the tool lags behind mouse movement.
    const inv = 1 / Math.max(dt, 1 / 240);
    const k = Math.min(1, dt * 10);
    const sw = 0.00004 * this.steady;
    this.swayY += (clamp(m.mouseDX * inv * sw, -0.08, 0.08) - this.swayY) * k;
    this.swayX += (clamp(m.mouseDY * inv * sw, -0.06, 0.06) - this.swayX) * k;
    const idle = Math.sin(this.time * 1.7) * 0.003;

    const [px, py, pz, rx, ry, rz] = POSE[this.current];
    this.holder.position.set(px + bx - this.swayY * 0.15, py + by + idle - lower * 0.45 - a * 0.03, pz - a * 0.12);
    this.holder.rotation.set(rx - a * 0.45 + this.swayX, ry + this.swayY, rz + bx * 2);
  }

  render(renderer: THREE.WebGLRenderer): void {
    renderer.clearDepth();
    renderer.render(this.scene, this.camera);
  }
}
