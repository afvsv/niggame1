import * as THREE from 'three';

/** Texel buffers of a procedural material: three S×S RGBA8 images, all tileable. */
export interface PBRData {
  size: number;
  albedo: Uint8Array; // sRGB, alpha used for cut-outs
  normal: Uint8Array; // tangent space
  rough: Uint8Array; // roughness in every channel
}

export interface PBRSet {
  map: THREE.DataTexture;
  normalMap: THREE.DataTexture;
  roughnessMap: THREE.DataTexture;
}

/** Sobel height → tangent-space normal map, wrapping at the edges. */
export function heightToNormal(H: Float32Array, S: number, strength: number): Uint8Array {
  const out = new Uint8Array(S * S * 4);
  const M = S - 1;
  for (let y = 0; y < S; y++) {
    const ym = ((y - 1) & M) * S, y0 = y * S, yp = ((y + 1) & M) * S;
    for (let x = 0; x < S; x++) {
      const xm = (x - 1) & M, xp = (x + 1) & M;
      const tl = H[ym + xm], t = H[ym + x], tr = H[ym + xp];
      const l = H[y0 + xm], r = H[y0 + xp];
      const bl = H[yp + xm], b = H[yp + x], br = H[yp + xp];
      const dx = tr + 2 * r + br - (tl + 2 * l + bl);
      const dy = bl + 2 * b + br - (tl + 2 * t + tr);
      // DataTextures are not flipped, so +y in the buffer is +v in UV space.
      let nx = -dx * strength, ny = -dy * strength, nz = 1;
      const inv = 1 / Math.sqrt(nx * nx + ny * ny + nz * nz);
      nx *= inv; ny *= inv; nz *= inv;
      const o = (y0 + x) * 4;
      out[o] = (nx * 0.5 + 0.5) * 255;
      out[o + 1] = (ny * 0.5 + 0.5) * 255;
      out[o + 2] = (nz * 0.5 + 0.5) * 255;
      out[o + 3] = 255;
    }
  }
  return out;
}

/** Separable wrapped box blur, used for cavity occlusion. */
export function boxBlur(src: Float32Array, S: number, r: number): Float32Array {
  const tmp = new Float32Array(S * S), out = new Float32Array(S * S);
  const M = S - 1, k = 1 / (2 * r + 1);
  for (let y = 0; y < S; y++) {
    let acc = 0;
    for (let i = -r; i <= r; i++) acc += src[y * S + (i & M)];
    for (let x = 0; x < S; x++) {
      tmp[y * S + x] = acc * k;
      acc += src[y * S + ((x + r + 1) & M)] - src[y * S + ((x - r) & M)];
    }
  }
  for (let x = 0; x < S; x++) {
    let acc = 0;
    for (let i = -r; i <= r; i++) acc += tmp[(i & M) * S + x];
    for (let y = 0; y < S; y++) {
      out[y * S + x] = acc * k;
      acc += tmp[((y + r + 1) & M) * S + x] - tmp[((y - r) & M) * S + x];
    }
  }
  return out;
}

function dataTex(data: Uint8Array, S: number, srgb: boolean, aniso: number): THREE.DataTexture {
  const t = new THREE.DataTexture(data, S, S, THREE.RGBAFormat, THREE.UnsignedByteType);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
  t.generateMipmaps = true;
  t.minFilter = THREE.LinearMipmapLinearFilter;
  t.magFilter = THREE.LinearFilter;
  t.anisotropy = aniso;
  t.needsUpdate = true;
  return t;
}

/** Uploads a generated material as three textures. */
export function toPBRSet(d: PBRData, aniso: number): PBRSet {
  return {
    map: dataTex(d.albedo, d.size, true, aniso),
    normalMap: dataTex(d.normal, d.size, false, aniso),
    roughnessMap: dataTex(d.rough, d.size, false, aniso),
  };
}

/** Plain linear RGBA8 texture, e.g. for variation noise. */
export function linearTex(data: Uint8Array, S: number): THREE.DataTexture {
  return dataTex(data, S, false, 1);
}

/** A copy of the set with its own repeat; images are shared. */
export function withRepeat(set: PBRSet, rx: number, ry: number): PBRSet {
  const c = (t: THREE.DataTexture) => {
    const n = t.clone();
    n.repeat.set(rx, ry);
    n.needsUpdate = true;
    return n;
  };
  return { map: c(set.map), normalMap: c(set.normalMap), roughnessMap: c(set.roughnessMap) };
}
