import * as THREE from 'three';
import { strawGeometry } from '../world/straws';

const MAX = 360;
const COLORS = ['#e3c47a', '#d6b060', '#c09445', '#efdb9c', '#b99b58'].map((c) => new THREE.Color(c));

/** Real little straws that fly off when digging, flutter down and settle on the floor. */
export class HayParticles {
  readonly object: THREE.InstancedMesh;
  private readonly pos = new Float32Array(MAX * 3);
  private readonly vel = new Float32Array(MAX * 3);
  private readonly rot = new Float32Array(MAX * 3);
  private readonly spin = new Float32Array(MAX * 3);
  private readonly len = new Float32Array(MAX);
  private readonly life = new Float32Array(MAX);
  private next = 0;
  private readonly m = new THREE.Matrix4();
  private readonly q = new THREE.Quaternion();
  private readonly e = new THREE.Euler();
  private readonly p = new THREE.Vector3();
  private readonly s = new THREE.Vector3();
  private readonly zero = new THREE.Matrix4().makeScale(0, 0, 0);

  constructor() {
    this.object = new THREE.InstancedMesh(strawGeometry(), new THREE.MeshStandardMaterial({ roughness: 0.6 }), MAX);
    this.object.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.object.frustumCulled = false;
    const c = new THREE.Color();
    for (let i = 0; i < MAX; i++) {
      this.object.setMatrixAt(i, this.zero);
      this.object.setColorAt(i, c.copy(COLORS[i % COLORS.length]).multiplyScalar(0.8 + Math.random() * 0.3));
    }
  }

  burst(x: number, y: number, z: number, nx: number, ny: number, nz: number, count: number): void {
    for (let k = 0; k < count; k++) {
      const i = this.next;
      this.next = (this.next + 1) % MAX;
      const r = () => Math.random() - 0.5;
      this.pos.set([x + r() * 0.2, y + r() * 0.2, z + r() * 0.2], i * 3);
      this.vel.set([nx * 0.6 + r() * 2.0, ny * 0.6 + 1.0 + Math.random() * 1.4, nz * 0.6 + r() * 2.0], i * 3);
      this.rot.set([Math.random() * 6.28, Math.random() * 6.28, Math.random() * 6.28], i * 3);
      this.spin.set([r() * 14, r() * 14, r() * 14], i * 3);
      this.len[i] = 0.06 + Math.random() * 0.12;
      this.life[i] = 1.4 + Math.random() * 1.2;
    }
  }

  update(dt: number): void {
    const P = this.pos, V = this.vel, R = this.rot, S = this.spin;
    const drag = Math.exp(-2.2 * dt);
    for (let i = 0; i < MAX; i++) {
      if (this.life[i] <= 0) continue;
      this.life[i] -= dt;
      const o = i * 3;
      if (this.life[i] <= 0) { this.object.setMatrixAt(i, this.zero); continue; }
      if (P[o + 1] > 0.012) {
        V[o + 1] -= 7 * dt;
        V[o] *= drag; V[o + 1] *= drag; V[o + 2] *= drag;
        P[o] += V[o] * dt; P[o + 1] += V[o + 1] * dt; P[o + 2] += V[o + 2] * dt;
        R[o] += S[o] * dt; R[o + 1] += S[o + 1] * dt; R[o + 2] += S[o + 2] * dt;
      } else {
        P[o + 1] = 0.012; // settle flat on the floor
        R[o] = 0; R[o + 2] *= 0.9;
      }
      const fade = Math.min(1, this.life[i] * 2.5);
      this.e.set(R[o], R[o + 1], R[o + 2]);
      this.q.setFromEuler(this.e);
      this.p.set(P[o], P[o + 1], P[o + 2]);
      this.s.set(this.len[i] * fade, 0.0028, 0.0028);
      this.m.compose(this.p, this.q, this.s);
      this.object.setMatrixAt(i, this.m);
    }
    this.object.instanceMatrix.needsUpdate = true;
  }
}
