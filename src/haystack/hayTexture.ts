import * as THREE from 'three';

/** Procedural, seamless straw texture drawn on a canvas. */
export function createHayTexture(renderer: THREE.WebGLRenderer): THREE.CanvasTexture {
  const size = 256;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = '#b8923f';
  ctx.fillRect(0, 0, size, size);
  const palette = ['#e9cf7c', '#d8b45a', '#b48a37', '#f3df98', '#9c7630', '#c9a24c'];
  let seed = 7;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  for (let i = 0; i < 1400; i++) {
    const x = rnd() * size, y = rnd() * size;
    const ang = rnd() * Math.PI;
    const len = 8 + rnd() * 34;
    ctx.strokeStyle = palette[Math.floor(rnd() * palette.length)];
    ctx.globalAlpha = 0.55 + rnd() * 0.45;
    ctx.lineWidth = 0.8 + rnd() * 1.8;
    const ex = Math.cos(ang) * len, ey = Math.sin(ang) * len;
    for (let ox = -size; ox <= size; ox += size)
      for (let oy = -size; oy <= size; oy += size) {
        ctx.beginPath();
        ctx.moveTo(x + ox, y + oy);
        ctx.lineTo(x + ox + ex, y + oy + ey);
        ctx.stroke();
      }
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
  return tex;
}
