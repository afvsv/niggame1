import * as THREE from 'three';
import { BALANCE } from '../data/balance';
import { Input } from '../core/input';
import { AABB, Colliders } from '../world/colliders';

const P = BALANCE.player;

/** First-person controller: capsule approximated by an AABB, axis-separated collision with step-up. */
export class PlayerController {
  readonly pos = new THREE.Vector3(); // feet position
  readonly vel = new THREE.Vector3();
  yaw = 0;
  pitch = 0;
  onGround = false;
  /** Multiplier from the settings. */
  sensitivity = 1;
  private readonly box: AABB = { minX: 0, minY: 0, minZ: 0, maxX: 0, maxY: 0, maxZ: 0 };

  constructor(private readonly colliders: Colliders, private readonly camera: THREE.PerspectiveCamera) {}

  private aabb(): AABB {
    const b = this.box, r = P.radius;
    b.minX = this.pos.x - r; b.maxX = this.pos.x + r;
    b.minY = this.pos.y; b.maxY = this.pos.y + P.height;
    b.minZ = this.pos.z - r; b.maxZ = this.pos.z + r;
    return b;
  }

  private blocked(): boolean { return this.colliders.collides(this.aabb()); }

  /** Moves along one axis; on collision binary-searches the furthest free position. Returns true if blocked. */
  private moveAxis(axis: 'x' | 'y' | 'z', delta: number): boolean {
    if (delta === 0) return false;
    const start = this.pos[axis];
    this.pos[axis] = start + delta;
    if (!this.blocked()) return false;
    let lo = 0, hi = 1;
    for (let i = 0; i < 8; i++) {
      const mid = (lo + hi) / 2;
      this.pos[axis] = start + delta * mid;
      if (this.blocked()) hi = mid; else lo = mid;
    }
    this.pos[axis] = start + delta * lo;
    return true;
  }

  private moveHorizontal(axis: 'x' | 'z', delta: number): void {
    const startY = this.pos.y, startH = this.pos[axis];
    if (!this.moveAxis(axis, delta) || !this.onGround) return;
    // Try stepping up onto a ledge (hay cells, low boxes).
    this.pos[axis] = startH;
    this.pos.y = startY + P.stepHeight;
    if (this.blocked() || this.moveAxis(axis, delta)) {
      this.pos.y = startY;
      this.pos[axis] = startH;
      this.moveAxis(axis, delta);
      return;
    }
    this.moveAxis('y', -P.stepHeight);
  }

  update(dt: number, input: Input): void {
    if (input.locked) {
      this.yaw -= input.mouseDX * P.mouseSensitivity * this.sensitivity;
      this.pitch -= input.mouseDY * P.mouseSensitivity * this.sensitivity;
      this.pitch = Math.max(-1.55, Math.min(1.55, this.pitch));
    }
    let fx = 0, fz = 0;
    if (input.locked) {
      if (input.down('KeyW')) fz -= 1;
      if (input.down('KeyS')) fz += 1;
      if (input.down('KeyA')) fx -= 1;
      if (input.down('KeyD')) fx += 1;
    }
    const len = Math.hypot(fx, fz) || 1;
    const speed = input.down('ShiftLeft') || input.down('ShiftRight') ? P.sprintSpeed : P.walkSpeed;
    const sin = Math.sin(this.yaw), cos = Math.cos(this.yaw);
    const wishX = ((fx * cos + fz * sin) / len) * speed;
    const wishZ = ((-fx * sin + fz * cos) / len) * speed;
    const accel = this.onGround ? 14 : 4;
    this.vel.x += (wishX - this.vel.x) * Math.min(1, accel * dt);
    this.vel.z += (wishZ - this.vel.z) * Math.min(1, accel * dt);

    if (this.onGround && input.locked && input.wasPressed('Space')) { this.vel.y = P.jumpSpeed; this.onGround = false; }
    this.vel.y -= P.gravity * dt;

    // Sub-step to avoid tunnelling through 0.2 m cells.
    const steps = Math.max(1, Math.ceil((Math.abs(this.vel.x) + Math.abs(this.vel.y) + Math.abs(this.vel.z)) * dt / 0.08));
    const h = dt / steps;
    for (let i = 0; i < steps; i++) {
      this.moveHorizontal('x', this.vel.x * h);
      this.moveHorizontal('z', this.vel.z * h);
      const vy = this.vel.y * h;
      if (this.moveAxis('y', vy)) {
        if (vy < 0) this.onGround = true;
        this.vel.y = 0;
      } else if (vy < 0) {
        this.onGround = false;
      }
    }
    // Stay grounded while walking down small slopes.
    if (this.vel.y <= 0 && !this.onGround) {
      const y0 = this.pos.y;
      if (this.moveAxis('y', -0.05)) this.onGround = true; else this.pos.y = y0;
    }

    this.camera.position.set(this.pos.x, this.pos.y + P.eyeHeight, this.pos.z);
    this.camera.rotation.set(this.pitch, this.yaw, 0, 'YXZ');
  }
}
