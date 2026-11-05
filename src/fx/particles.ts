import * as THREE from 'three';

const MAX = 400;

/** Cheap straw bits flying off when digging. */
export class HayParticles {
  readonly points: THREE.Points;
  private readonly pos = new Float32Array(MAX * 3);
  private readonly vel = new Float32Array(MAX * 3);
  private readonly life = new Float32Array(MAX);
  private next = 0;

  constructor() {
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(this.pos, 3).setUsage(THREE.DynamicDrawUsage));
    const mat = new THREE.PointsMaterial({ color: '#e2c46e', size: 0.045, sizeAttenuation: true });
    this.points = new THREE.Points(geo, mat);
    this.points.frustumCulled = false;
    for (let i = 0; i < MAX; i++) this.pos[i * 3 + 1] = -100;
  }

  burst(x: number, y: number, z: number, nx: number, ny: number, nz: number, count: number): void {
    for (let k = 0; k < count; k++) {
      const i = this.next;
      this.next = (this.next + 1) % MAX;
      this.pos[i * 3] = x + (Math.random() - 0.5) * 0.15;
      this.pos[i * 3 + 1] = y + (Math.random() - 0.5) * 0.15;
      this.pos[i * 3 + 2] = z + (Math.random() - 0.5) * 0.15;
      this.vel[i * 3] = nx * 1.2 + (Math.random() - 0.5) * 1.6;
      this.vel[i * 3 + 1] = ny * 1.2 + 0.8 + Math.random() * 1.4;
      this.vel[i * 3 + 2] = nz * 1.2 + (Math.random() - 0.5) * 1.6;
      this.life[i] = 0.5 + Math.random() * 0.5;
    }
  }

  update(dt: number): void {
    for (let i = 0; i < MAX; i++) {
      if (this.life[i] <= 0) continue;
      this.life[i] -= dt;
      if (this.life[i] <= 0) { this.pos[i * 3 + 1] = -100; continue; }
      this.vel[i * 3 + 1] -= 6 * dt;
      this.pos[i * 3] += this.vel[i * 3] * dt;
      this.pos[i * 3 + 1] += this.vel[i * 3 + 1] * dt;
      this.pos[i * 3 + 2] += this.vel[i * 3 + 2] * dt;
    }
    (this.points.geometry.getAttribute('position') as THREE.BufferAttribute).needsUpdate = true;
  }
}
