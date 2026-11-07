import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { floorStraws, strawGeometry } from './straws';
import { aFrame, KIOSK_PLACEMENT, PRICE_FRAME, sellBooth, STALL_PLACEMENT, supplyStall } from './booths';
import type { Mats } from './booths';
import { mulberry32 } from '../gfx/noise';

// Headless canvas: signs and tool materials paint with 2d contexts that node does not have.
const ctxStub: Record<string, unknown> = new Proxy({}, {
  get: (_t, k: string) => {
    if (k === 'measureText') return () => ({ width: 24 });
    return () => undefined;
  },
  set: () => true,
});
(globalThis as unknown as Record<string, unknown>).document = {
  createElement: () => ({ width: 256, height: 256, getContext: () => ctxStub, style: {} }),
} as unknown as Document;

const mat = (color: string, o: THREE.MeshStandardMaterialParameters = {}): THREE.MeshStandardMaterial =>
  new THREE.MeshStandardMaterial({ color, roughness: 0.6, ...o });
const m: Mats = {
  beam: mat('#857565'), boards: mat('#a08b74'), metal: mat('#9aa0a2'), iron: mat('#3b3a38', { metalness: 0.75 }),
  steel: mat('#5d6d74', { metalness: 0.55 }), rubber: mat('#1f1f1e', { roughness: 0.92 }), hay: mat('#d0b070'),
  yellow: mat('#d9a51c'), black: mat('#1a1917'), red: mat('#97302a'), burlap: mat('#a08660', { roughness: 1 }), leaf: mat('#4f6d36'),
};

const box3Of = (o: THREE.Object3D): THREE.Box3 => new THREE.Box3().setFromObject(o);
/** True overlap (touching within eps is allowed). */
const overlaps = (a: THREE.Box3, b: THREE.Box3): boolean =>
  a.min.x < b.max.x - 1e-4 && a.max.x > b.min.x + 1e-4 &&
  a.min.y < b.max.y - 1e-4 && a.max.y > b.min.y + 1e-4 &&
  a.min.z < b.max.z - 1e-4 && a.max.z > b.min.z + 1e-4;
/** Smallest x/z distance between a box and a point (0 when the point is inside). */
const distXZ = (b: THREE.Box3, x: number, z: number): number => {
  const dx = Math.max(b.min.x - x, 0, x - b.max.x), dz = Math.max(b.min.z - z, 0, z - b.max.z);
  return Math.hypot(dx, dz);
};
/** Smallest x/z distance between a box and the plane x = px. */
const distPlaneX = (b: THREE.Box3, px: number): number =>
  px < b.min.x ? b.min.x - px : px > b.max.x ? px - b.max.x : 0;
const named = (root: THREE.Object3D, name: string): THREE.Object3D => {
  const o = root.getObjectByName(name);
  expect(o, `missing prop "${name}"`).toBeTruthy();
  return o!;
};
const lum = (c: THREE.Color): number => 0.2126 * c.r + 0.7152 * c.g + 0.0722 * c.b;
/** Perceived brightness the way it was authored: instance colours live in linear-sRGB. */
const srgbLum = (c: THREE.Color): number => {
  const s = new THREE.Color();
  c.getRGB(s, THREE.SRGBColorSpace);
  return lum(s);
};

// The furniture, built and placed exactly like shed.ts does.
const sell = sellBooth(m);
const kiosk = sell.kit.place(new THREE.Group(), () => {}, KIOSK_PLACEMENT.x, KIOSK_PLACEMENT.z, KIOSK_PLACEMENT.ry);
kiosk.updateMatrixWorld(true);
const stall = supplyStall(m).place(new THREE.Group(), () => {}, STALL_PLACEMENT.x, STALL_PLACEMENT.z, STALL_PLACEMENT.ry);
stall.updateMatrixWorld(true);
const sign = aFrame(m, null).place(new THREE.Group(), () => {}, PRICE_FRAME.x, PRICE_FRAME.z, PRICE_FRAME.ry);
sign.updateMatrixWorld(true);

const COUNTER_TOP = 0.96;

describe('kiosk and supply stall models (headless Box3 checks)', () => {
  it('D8: the price A-frame stands clear of the platform scale, legs on the floor', () => {
    const signBox = box3Of(sign);
    const deckBox = box3Of(named(kiosk, 'scale-deck'));
    expect(signBox.intersectsBox(deckBox)).toBe(false);
    const sc = signBox.getCenter(new THREE.Vector3()), dc = deckBox.getCenter(new THREE.Vector3());
    expect(Math.hypot(sc.x - dc.x, sc.z - dc.z)).toBeGreaterThanOrEqual(1.3);
    expect(signBox.min.y).toBeGreaterThanOrEqual(-0.02);
    expect(signBox.min.y).toBeLessThanOrEqual(0.01); // the legs touch the floor
  });

  it('D9: the scale is one aligned group with the pole at the rear edge and the dial to the yard', () => {
    const scale = named(kiosk, 'scale');
    expect(scale.rotation.y).toBeCloseTo(0.5, 1); // the dial and the plate face the yard
    const base = box3Of(named(scale, 'scale-base'));
    const plate = box3Of(named(scale, 'scale-plate'));
    const pole = box3Of(named(scale, 'scale-pole'));
    expect(plate.min.y).toBeCloseTo(base.max.y, 2); // the plate sits on the base
    expect(pole.min.y).toBeLessThanOrEqual(plate.max.y + 0.005); // the pole stands on the plate
    const poleLocal = scale.worldToLocal(pole.getCenter(new THREE.Vector3()));
    expect(poleLocal.z).toBeCloseTo(-0.42, 1); // rear edge of the plate, not the middle
    const dialDir = new THREE.Vector3(0, 0, 1).applyQuaternion(named(scale, 'scale-dial').getWorldQuaternion(new THREE.Quaternion()));
    expect(dialDir.x).toBeLessThan(-0.7); // faces the yard (towards the spawn side)
    expect(dialDir.z).toBeGreaterThan(0.3);
  });

  it('D10: the conveyor motor sits on a base plate on the floor with a shaft to a roller', () => {
    const motor = named(kiosk, 'motor');
    const mb = box3Of(motor);
    expect(mb.min.y).toBeGreaterThanOrEqual(0.005); // hangar floor top is 0.01
    expect(mb.min.y).toBeLessThanOrEqual(0.015);
    expect(named(motor, 'motor-shaft')).toBeTruthy();
  });

  it('D11: floor straws are thin, near-straight and never much darker than the floor', () => {
    const g = strawGeometry();
    const p = g.getAttribute('position') as THREE.BufferAttribute;
    let maxBow = 0;
    for (let ring = 0; ring < 3; ring++) {
      let mean = 0;
      for (let k = 0; k < 3; k++) mean += p.getY(ring * 3 + k); // the axis offset: cos terms cancel in the ring mean
      maxBow = Math.max(maxBow, Math.abs(mean / 3));
    }
    expect(maxBow).toBeLessThanOrEqual(0.021); // bow <= 0.02 of the unit length
    const mesh = floorStraws(6500, 7.4, mulberry32(5), { hx: 15, hz: 22, counter: [12.1, -8.3] });
    const s = new THREE.Vector3();
    let lensOk = true, minLum = 1;
    const c = new THREE.Color();
    for (let i = 0; i < 6500; i += 20) {
      mesh.getMatrixAt(i, new THREE.Matrix4()).decompose(new THREE.Vector3(), new THREE.Quaternion(), s);
      if (s.x < 0.18 - 1e-6 || s.x > 0.35 + 1e-6) lensOk = false;
      mesh.getColorAt(i, c);
      minLum = Math.min(minLum, srgbLum(c));
    }
    expect(lensOk).toBe(true); // length 0.18-0.35 m
    expect(mesh.instanceMatrix.count).toBe(6500); // instance count unchanged
    expect(minLum).toBeGreaterThan(0.5); // no near-black straws on the light floor
  });

  it('D12: kiosk bales keep 1 m from the window line and the conveyor low end, and wear straps', () => {
    const windowX = KIOSK_PLACEMENT.x - 1.06; // the line along the front face through the window centre
    for (let i = 1; i <= 3; i++) {
      const bale = named(kiosk, `bale-kiosk-${i}`);
      const bb = box3Of(bale);
      expect(distPlaneX(bb, windowX)).toBeGreaterThanOrEqual(1.0);
      expect(distXZ(bb, 7.7, -7.74)).toBeGreaterThanOrEqual(1.0); // conveyor low end
      expect(bale.children.filter((c) => c.name.startsWith('strap')).length).toBe(2);
    }
  });

  it('D13: the price card rectangle is not cut by shelves, jars or crates', () => {
    const card = box3Of(named(kiosk, 'price-card'));
    for (const nm of ['kiosk-shelf-1', 'kiosk-shelf-2', 'kiosk-jar-1', 'kiosk-jar-2', 'kiosk-jar-3', 'kiosk-jar-4', 'kiosk-jar-5', 'kiosk-crate-1', 'kiosk-crate-2']) {
      expect(overlaps(card, box3Of(named(kiosk, nm))), `card vs ${nm}`).toBe(false);
    }
  });

  it('D14: kiosk jars and crates sit exactly on their shelves, in readable colours', () => {
    const s1 = box3Of(named(kiosk, 'kiosk-shelf-1')).max.y;
    const s2 = box3Of(named(kiosk, 'kiosk-shelf-2')).max.y;
    const check = (nm: string, top: number) => {
      const b = box3Of(named(kiosk, nm));
      expect(b.min.y, nm).toBeGreaterThanOrEqual(top - 0.005);
      expect(b.min.y, nm).toBeLessThanOrEqual(top + 0.005);
    };
    for (const nm of ['kiosk-jar-1', 'kiosk-jar-2', 'kiosk-jar-3', 'kiosk-jar-4', 'kiosk-crate-1']) check(nm, s1);
    for (const nm of ['kiosk-jar-5', 'kiosk-crate-2']) check(nm, s2);
    for (let i = 1; i <= 5; i++) {
      const body = named(kiosk, `kiosk-jar-${i}`).getObjectByName('jar-body') as THREE.Mesh;
      const mt = body.material as THREE.MeshStandardMaterial;
      expect(srgbLum(mt.color), `jar ${i} luminance`).toBeGreaterThan(0.15); // L > 15%
      expect(mt.roughness, `jar ${i} roughness`).toBeLessThanOrEqual(0.6);
    }
  });

  it('D14: stall jars and crates sit exactly on their shelves too', () => {
    const tops = [1, 2, 3].map((i) => box3Of(named(stall, `stall-shelf-${i}`)).max.y);
    const settle = (nm: string) => {
      const b = box3Of(named(stall, nm));
      expect(tops.some((t) => Math.abs(b.min.y - t) <= 0.005), `${nm} bottom ${b.min.y.toFixed(3)} vs tops ${tops.map((t) => t.toFixed(3))}`).toBe(true);
    };
    let jars = 0, crates = 0, stacks = 0;
    for (let i = 1; i <= 20; i++) {
      if (stall.getObjectByName(`stall-jar-${i}`)) {
        jars++;
        settle(`stall-jar-${i}`);
        const body = named(stall, `stall-jar-${i}`).getObjectByName('jar-body') as THREE.Mesh;
        expect(srgbLum((body.material as THREE.MeshStandardMaterial).color), `stall-jar-${i} luminance`).toBeGreaterThan(0.15);
      }
      if (stall.getObjectByName(`stall-crate-${i}`)) { crates++; settle(`stall-crate-${i}`); }
      if (stall.getObjectByName(`stall-cups-${i}`)) { stacks++; settle(`stall-cups-${i}`); }
    }
    expect(jars).toBeGreaterThanOrEqual(3); // the shelves are stocked
    expect(crates).toBeGreaterThanOrEqual(1);
    expect(stacks).toBeGreaterThanOrEqual(1);
  });

  it('D15: cups are tapered cones and the red box became a real tin', () => {
    const cups = named(stall, 'cups');
    const cone = named(cups, 'cup-cone') as THREE.Mesh;
    const gp = (cone.geometry as THREE.CylinderGeometry).parameters;
    expect(gp.radiusTop).toBeGreaterThan(gp.radiusBottom); // a cone, not a pancake
    expect(gp.height).toBeCloseTo(0.09, 1);
    expect(box3Of(cups).min.y).toBeCloseTo(COUNTER_TOP, 2);
    const tin = named(stall, 'tin');
    expect(box3Of(tin).min.y).toBeCloseTo(COUNTER_TOP, 2);
    expect(named(tin, 'tin-lid')).toBeTruthy();
    expect(named(tin, 'tin-latch')).toBeTruthy();
    const body = (tin.children.find((c) => c.name === 'tin-body') as THREE.Mesh).material as THREE.MeshStandardMaterial;
    expect(body.roughness).toBeCloseTo(0.55, 1);
    const pail = named(stall, 'pail');
    expect(box3Of(pail).min.y).toBeGreaterThanOrEqual(COUNTER_TOP - 0.005);
    expect(box3Of(pail).min.y).toBeLessThanOrEqual(COUNTER_TOP + 0.005);
    // shelf cup stacks rest on their shelves
    for (let i = 1; i <= 9; i++) {
      const stack = stall.getObjectByName(`stall-cups-${i}`);
      if (stack) {
        const b = box3Of(stack).min.y;
        const tops = [1, 2, 3].map((k) => box3Of(named(stall, `stall-shelf-${k}`)).max.y);
        expect(tops.some((t) => Math.abs(b - t) <= 0.005), `stall-cups-${i} at ${b.toFixed(3)}`).toBe(true);
      }
    }
  });

  it('D16: the toy shovel lies flat on the counter, no red head', () => {
    const shovel = named(stall, 'toy-shovel');
    const sb = box3Of(shovel);
    expect(sb.min.y).toBeGreaterThanOrEqual(COUNTER_TOP - 0.005);
    expect(sb.min.y).toBeLessThanOrEqual(COUNTER_TOP + 0.005);
    const spanZ = sb.max.z - sb.min.z, spanY = sb.max.y - sb.min.y;
    expect(spanZ).toBeGreaterThan(spanY * 2); // lying down: long axis horizontal
    let red = false;
    shovel.traverse((o) => { if (o instanceof THREE.Mesh && (o.material as THREE.MeshStandardMaterial).color?.getHex() === 0xb3301f) red = true; });
    expect(red).toBe(false);
  });

  it('D16: hanging tools stay 0.15 m under the beam, apart, resting on wall pegs', () => {
    const beam = box3Of(named(stall, 'stall-beam'));
    const spade = named(stall, 'tool-spade');
    const fork = named(stall, 'tool-pitchfork');
    for (const [nm, tool] of [['tool-spade', spade], ['tool-pitchfork', fork]] as const) {
      const tb = box3Of(named(tool, 'tool-body'));
      expect(tb.max.y, `${nm} under the beam`).toBeLessThanOrEqual(beam.min.y - 0.15);
      const pegs = [1, 2].map((i) => named(tool, `peg-${i}`) as THREE.Mesh);
      for (const peg of pegs) {
        const pb = box3Of(peg);
        const local = stall.worldToLocal(pb.getCenter(new THREE.Vector3()));
        expect(Math.abs(local.z - (-1.19)), `${nm} peg on the wall`).toBeLessThan(0.06); // spans the wall face at z -1.22
        expect(overlaps(pb, tb), `${nm} peg touches the handle`).toBe(true);
      }
    }
    expect(overlaps(box3Of(spade), box3Of(fork))).toBe(false); // the two tools do not overlap
    const blade = named(spade, 'blade') as THREE.Mesh;
    expect((blade.material as THREE.MeshStandardMaterial).color.getHex()).toBe(0x8a8f94); // steel, not white
  });

  it('props do not poke through the ceiling beams', () => {
    const beam = box3Of(named(stall, 'stall-beam'));
    const awning = box3Of(named(stall, 'stall-awning-beam'));
    stall.traverse((o) => {
      if (!(o instanceof THREE.Group) || !o.name || o.name === 'stall-beam' || o.name === 'stall-awning-beam') return;
      const b = box3Of(o);
      expect(overlaps(b, beam), `${o.name} vs store-room beam`).toBe(false);
      expect(overlaps(b, awning), `${o.name} vs awning beam`).toBe(false);
    });
  });
});
