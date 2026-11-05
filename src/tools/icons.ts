import * as THREE from 'three';
import type { ItemId } from '../data/tools';
import { buildModel, iconPose } from './models';

/**
 * Renders each item model into an offscreen target and returns PNG data URLs.
 * Render targets skip tone mapping and output colour conversion, so pixels are
 * converted from linear to sRGB here. Rendered at 2x and downscaled for smooth edges.
 */
export function renderIcons(renderer: THREE.WebGLRenderer, ids: readonly ItemId[], size = 96): Map<ItemId, string> {
  const S = size * 2;
  const rt = new THREE.WebGLRenderTarget(S, S);
  const scene = new THREE.Scene();
  scene.add(new THREE.HemisphereLight('#fff4dc', '#6a5a43', 2.4));
  const key = new THREE.DirectionalLight('#ffffff', 2.2);
  key.position.set(-1.5, 2.5, 3);
  scene.add(key);
  const cam = new THREE.PerspectiveCamera(28, 1, 0.01, 50);

  const lut = new Uint8Array(256);
  for (let i = 0; i < 256; i++) {
    const c = i / 255;
    lut[i] = Math.round(255 * (c <= 0.0031308 ? 12.92 * c : 1.055 * c ** (1 / 2.4) - 0.055));
  }
  const buf = new Uint8Array(S * S * 4);
  const big = document.createElement('canvas');
  big.width = big.height = S;
  const bctx = big.getContext('2d')!;
  const img = bctx.createImageData(S, S);
  const out = document.createElement('canvas');
  out.width = out.height = size;
  const octx = out.getContext('2d')!;
  octx.imageSmoothingQuality = 'high';

  const prevTarget = renderer.getRenderTarget();
  const prevColor = renderer.getClearColor(new THREE.Color());
  const prevAlpha = renderer.getClearAlpha();
  renderer.setClearColor(0x000000, 0);

  const result = new Map<ItemId, string>();
  const sphere = new THREE.Sphere();
  for (const id of ids) {
    const model = buildModel(id);
    const pose = iconPose(id);
    model.rotation.copy(pose.rot);
    scene.add(model);
    model.updateMatrixWorld(true);
    new THREE.Box3().setFromObject(model).getBoundingSphere(sphere);
    const dist = (sphere.radius / Math.sin(THREE.MathUtils.degToRad(cam.fov / 2))) * 0.9;
    cam.position.set(sphere.center.x, sphere.center.y + Math.sin(pose.elevation) * dist, sphere.center.z + Math.cos(pose.elevation) * dist);
    cam.lookAt(sphere.center);

    renderer.setRenderTarget(rt);
    renderer.clear();
    renderer.render(scene, cam);
    renderer.readRenderTargetPixels(rt, 0, 0, S, S, buf);
    const d = img.data;
    for (let y = 0; y < S; y++) {
      const src = (S - 1 - y) * S * 4;
      const dst = y * S * 4;
      for (let x = 0; x < S * 4; x += 4) {
        d[dst + x] = lut[buf[src + x]];
        d[dst + x + 1] = lut[buf[src + x + 1]];
        d[dst + x + 2] = lut[buf[src + x + 2]];
        d[dst + x + 3] = buf[src + x + 3];
      }
    }
    bctx.putImageData(img, 0, 0);
    octx.clearRect(0, 0, size, size);
    octx.drawImage(big, 0, 0, size, size);
    result.set(id, out.toDataURL('image/png'));

    scene.remove(model);
    model.traverse((o) => { if (o instanceof THREE.Mesh) o.geometry.dispose(); });
  }

  renderer.setRenderTarget(prevTarget);
  renderer.setClearColor(prevColor, prevAlpha);
  rt.dispose();
  return result;
}
