import * as THREE from 'three';

const beamVert = /* glsl */ `
attribute vec2 beam; // x: across the face 0..1, y: along the beam 0 (opening) .. 1 (floor)
varying vec2 vBeam;
varying vec3 vWorld;
void main() {
  vBeam = beam;
  vec4 w = modelMatrix * vec4(position, 1.0);
  vWorld = w.xyz;
  gl_Position = projectionMatrix * viewMatrix * w;
}`;
const beamFrag = /* glsl */ `
uniform vec3 color;
uniform float strength, time;
varying vec2 vBeam;
varying vec3 vWorld;
void main() {
  float edge = sin(vBeam.x * 3.14159);
  float along = smoothstep(0.0, 0.08, vBeam.y) * pow(1.0 - vBeam.y, 0.7);
  float flicker = 0.85 + 0.15 * sin(time * 0.7 + vWorld.x * 0.9 + vWorld.z * 1.3 + vWorld.y * 0.6);
  float a = edge * edge * along * strength * flicker;
  gl_FragColor = vec4(color * a, 1.0);
}`;

export interface BeamSource { corners: THREE.Vector3[]; strength: number } // 4 corners of an opening, in order

/**
 * Fake volumetric light: each opening is extruded along the sun direction down to the floor
 * and drawn additively, with floating dust motes inside the beams.
 */
export class Sunbeams {
  readonly group = new THREE.Group();
  private readonly uniforms: Array<{ time: { value: number } }> = [];
  private readonly motes: THREE.Points;
  private readonly moteBase: Float32Array;
  private readonly motePhase: Float32Array;
  private time = 0;

  constructor(sources: BeamSource[], sunDir: THREE.Vector3) {
    const down = sunDir.clone().negate();
    const seeds: Array<{ top: THREE.Vector3[]; bottom: THREE.Vector3[] }> = [];
    for (const src of sources) {
      const top = src.corners;
      const bottom = top.map((c) => c.clone().addScaledVector(down, Math.max(0.01, c.y / -down.y)));
      seeds.push({ top, bottom });
      const pos: number[] = [], beam: number[] = [];
      for (let k = 0; k < 4; k++) {
        const a = top[k], b = top[(k + 1) % 4], c = bottom[(k + 1) % 4], d = bottom[k];
        pos.push(a.x, a.y, a.z, b.x, b.y, b.z, c.x, c.y, c.z, a.x, a.y, a.z, c.x, c.y, c.z, d.x, d.y, d.z);
        beam.push(0, 0, 1, 0, 1, 1, 0, 0, 1, 1, 0, 1);
      }
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
      g.setAttribute('beam', new THREE.Float32BufferAttribute(beam, 2));
      const u = { color: { value: new THREE.Color('#ffdcaa') }, strength: { value: src.strength }, time: { value: 0 } };
      this.uniforms.push(u);
      const mat = new THREE.ShaderMaterial({
        vertexShader: beamVert, fragmentShader: beamFrag, uniforms: u,
        transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
      });
      const mesh = new THREE.Mesh(g, mat);
      mesh.renderOrder = 5;
      this.group.add(mesh);
    }
    // Dust motes spread through the beams.
    const N = 500;
    this.moteBase = new Float32Array(N * 3);
    this.motePhase = new Float32Array(N);
    const p = new THREE.Vector3(), q = new THREE.Vector3();
    // Pick beams in proportion to their volume-ish strength so the faint doorway beam gets few motes.
    const weights = sources.map((src) => src.strength);
    const total = weights.reduce((a, b) => a + b, 0);
    for (let i = 0; i < N; i++) {
      let r = Math.random() * total, si = 0;
      while (si < weights.length - 1 && r > weights[si]) r -= weights[si++];
      const s = seeds[si];
      const u = Math.random(), v = Math.random(), t = 0.05 + Math.random() * 0.85;
      p.copy(s.top[0]).lerp(s.top[1], u).lerp(q.copy(s.top[3]).lerp(s.top[2], u), v);
      const b = new THREE.Vector3().copy(s.bottom[0]).lerp(s.bottom[1], u).lerp(q.copy(s.bottom[3]).lerp(s.bottom[2], u), v);
      p.lerp(b, t);
      this.moteBase.set([p.x, p.y, p.z], i * 3);
      this.motePhase[i] = Math.random() * 100;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(this.moteBase.slice(), 3).setUsage(THREE.DynamicDrawUsage));
    const c = document.createElement('canvas');
    c.width = c.height = 32;
    const ctx = c.getContext('2d')!;
    const grd = ctx.createRadialGradient(16, 16, 0, 16, 16, 16);
    grd.addColorStop(0, 'rgba(255,255,255,1)');
    grd.addColorStop(0.35, 'rgba(255,240,210,.5)');
    grd.addColorStop(1, 'rgba(255,240,210,0)');
    ctx.fillStyle = grd;
    ctx.fillRect(0, 0, 32, 32);
    const sprite = new THREE.CanvasTexture(c);
    this.motes = new THREE.Points(geo, new THREE.PointsMaterial({
      map: sprite, size: 0.022, color: '#ffe6bd', transparent: true, opacity: 0.55, depthWrite: false, blending: THREE.AdditiveBlending, fog: false,
    }));
    this.motes.frustumCulled = false;
    this.motes.renderOrder = 6;
    this.group.add(this.motes);
  }

  update(dt: number): void {
    this.time += dt;
    for (const u of this.uniforms) u.time.value = this.time;
    const a = this.motes.geometry.getAttribute('position') as THREE.BufferAttribute;
    const arr = a.array as Float32Array, t = this.time;
    for (let i = 0; i < this.motePhase.length; i++) {
      const ph = this.motePhase[i];
      arr[i * 3] = this.moteBase[i * 3] + Math.sin(t * 0.13 + ph) * 0.35;
      arr[i * 3 + 1] = this.moteBase[i * 3 + 1] + Math.sin(t * 0.09 + ph * 1.7) * 0.25;
      arr[i * 3 + 2] = this.moteBase[i * 3 + 2] + Math.cos(t * 0.11 + ph * 0.6) * 0.35;
    }
    a.needsUpdate = true;
  }
}
