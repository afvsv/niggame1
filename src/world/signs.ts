import * as THREE from 'three';
import { t } from '../core/i18n';
import { SHOP_ITEMS } from '../data/tools';
import { NEEDLES, NeedleId } from '../data/needles';
import { needleName, needlePerk } from '../ui/needleText';
import { BALANCE } from '../data/balance';
import { mulberry32 } from '../gfx/noise';

// Canvas textures for the signs and boards in the hangar.

export const FONT = '"Roboto Condensed Variable", "Arial Narrow", sans-serif';

/** Dark weathered plank sign with light uppercase lettering. */
export function signTexture(text: string): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = 512; c.height = 128;
  const ctx = c.getContext('2d')!;
  ctx.fillStyle = '#2e241b';
  ctx.fillRect(0, 0, 512, 128);
  for (let i = 0; i < 90; i++) {
    ctx.fillStyle = `rgba(${Math.random() < 0.5 ? '0,0,0' : '255,235,200'},${Math.random() * 0.06})`;
    ctx.fillRect(0, Math.random() * 128, 512, 1 + Math.random() * 2);
  }
  ctx.strokeStyle = 'rgba(239,233,218,.55)';
  ctx.lineWidth = 3;
  ctx.strokeRect(10, 10, 492, 108);
  ctx.fillStyle = '#efe9da';
  ctx.font = `700 64px ${FONT}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text.toUpperCase(), 256, 68);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

/** Chalk A-frame with the current price per strand. */
export function priceTexture(): THREE.CanvasTexture {
  const W = 256, H = 384;
  const c = document.createElement('canvas');
  c.width = W; c.height = H;
  const ctx = c.getContext('2d')!;
  ctx.fillStyle = '#22272a';
  ctx.fillRect(0, 0, W, H);
  for (let i = 0; i < 500; i++) {
    ctx.fillStyle = `rgba(236,230,211,${Math.random() * 0.05})`;
    ctx.fillRect(Math.random() * W, Math.random() * H, 2 + Math.random() * 10, 1 + Math.random() * 2);
  }
  ctx.fillStyle = '#ece6d3';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = `700 64px ${FONT}`;
  ctx.fillText(`$${BALANCE.hay.pricePerStrand.toFixed(2)}`, W / 2, H / 2 - 30);
  ctx.font = `700 30px ${FONT}`;
  ctx.fillText(t('counter.price').toUpperCase(), W / 2, H / 2 + 30);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

/** Chalkboard with pinned paper price tags: the supply board. */
export function boardTexture(): THREE.CanvasTexture {
  const W = 1024, H = 640;
  const c = document.createElement('canvas');
  c.width = W; c.height = H;
  const ctx = c.getContext('2d')!;
  ctx.fillStyle = '#5b3d24';
  ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = '#2f3a33';
  ctx.fillRect(28, 28, W - 56, H - 56);
  for (let i = 0; i < 1600; i++) { // chalk dust
    ctx.fillStyle = `rgba(236,230,211,${Math.random() * 0.06})`;
    ctx.fillRect(28 + Math.random() * (W - 56), 28 + Math.random() * (H - 56), 2 + Math.random() * 14, 1 + Math.random() * 2);
  }
  ctx.fillStyle = '#ece6d3';
  ctx.font = `700 96px ${FONT}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(t('shop.sign').toUpperCase(), W / 2, 130);
  ctx.fillRect(W / 2 - 220, 196, 440, 4);
  SHOP_ITEMS.slice(0, 3).forEach((item, i) => {
    ctx.save();
    ctx.translate(200 + i * 312, 410);
    ctx.rotate((i - 1) * 0.06 + (i === 1 ? 0.03 : -0.02));
    ctx.fillStyle = 'rgba(0,0,0,.25)';
    ctx.fillRect(-128, -84, 268, 180);
    ctx.fillStyle = '#efe3c2';
    ctx.fillRect(-134, -92, 268, 180);
    ctx.fillStyle = '#2b241b';
    const name = t(`item.${item.id}`);
    let size = 30;
    do ctx.font = `500 ${size}px ${FONT}`; while (ctx.measureText(name).width > 236 && --size > 16);
    ctx.fillText(name, 0, -36);
    ctx.font = `700 64px ${FONT}`;
    ctx.fillText(`$${item.price}`, 0, 34);
    ctx.fillStyle = '#b5523b';
    ctx.beginPath();
    ctx.arc(0, -78, 9, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  });
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

/** Needle board by the exit: six framed slots, filled in as needles are found. */
export function needleBoard(): { tex: THREE.CanvasTexture; draw(found: readonly NeedleId[]): void } {
  const W = 1024, H = 680;
  const c = document.createElement('canvas');
  c.width = W; c.height = H;
  const ctx = c.getContext('2d')!;
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  const rnd = mulberry32(31);
  const dust = Array.from({ length: 1400 }, () => [rnd() * W, rnd() * H, 2 + rnd() * 14, 1 + rnd() * 2, rnd() * 0.06]);
  const drawNeedle = (id: NeedleId, x: number, y: number, ok: boolean) => {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(-0.5);
    ctx.strokeStyle = ok ? '#e8edf0' : 'rgba(236,230,211,.18)';
    ctx.fillStyle = ok ? (id === 'desk_pin' ? '#c8382c' : id === 'hat_pin' ? '#f2e6d8' : '#e8edf0') : 'rgba(236,230,211,.18)';
    ctx.lineCap = 'round';
    ctx.lineWidth = id === 'darning' ? 7 : 5;
    ctx.beginPath();
    if (id === 'bent_pin') { ctx.moveTo(-60, 0); ctx.lineTo(20, 0); ctx.lineTo(60, -22); }
    else if (id === 'safety_pin') { ctx.moveTo(60, -6); ctx.lineTo(-50, -6); ctx.arc(-50, 4, 10, -Math.PI / 2, Math.PI / 2, true); ctx.lineTo(60, 14); }
    else if (id === 'desk_pin') { ctx.moveTo(0, 0); ctx.lineTo(40, 0); }
    else { ctx.moveTo(-70, 0); ctx.lineTo(70, 0); }
    ctx.stroke();
    ctx.beginPath();
    if (id === 'bent_pin') ctx.arc(-62, 0, 9, 0, Math.PI * 2);
    else if (id === 'desk_pin') ctx.ellipse(-4, 0, 10, 30, 0, 0, Math.PI * 2);
    else if (id === 'hat_pin') ctx.arc(-72, 0, 16, 0, Math.PI * 2);
    else if (id === 'safety_pin') ctx.rect(56, -12, 18, 30);
    if (id !== 'sewing' && id !== 'darning') ctx.fill();
    else { ctx.lineWidth = 3; ctx.ellipse(-62, 0, 7, 3, 0, 0, Math.PI * 2); ctx.stroke(); }
    ctx.restore();
  };
  const draw = (found: readonly NeedleId[]) => {
    ctx.fillStyle = '#4a311d';
    ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = '#262d29';
    ctx.fillRect(24, 24, W - 48, H - 48);
    for (const [x, y, w, h, a] of dust) { ctx.fillStyle = `rgba(236,230,211,${a})`; ctx.fillRect(x, y, w, h); }
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const open = found.length >= NEEDLES.length;
    ctx.fillStyle = open ? '#9fcf6b' : '#ece6d3';
    ctx.font = `700 66px ${FONT}`;
    ctx.fillText(t(open ? 'board.open' : 'board.locked').toUpperCase(), W / 2, 92);
    ctx.font = `600 34px ${FONT}`;
    ctx.fillStyle = '#c9c2ab';
    ctx.fillText(t('board.sub', { n: found.length, total: NEEDLES.length }), W / 2, 150);
    NEEDLES.forEach((n, i) => {
      const col = i % 3, row = Math.floor(i / 3);
      const x = 60 + col * 304, y = 196 + row * 228;
      const ok = found.includes(n.id);
      ctx.strokeStyle = ok ? '#d4ac3f' : 'rgba(236,230,211,.3)';
      ctx.lineWidth = 3;
      ctx.setLineDash(ok ? [] : [10, 8]);
      ctx.strokeRect(x, y, 280, 206);
      ctx.setLineDash([]);
      drawNeedle(n.id, x + 140, y + 74, ok);
      ctx.fillStyle = ok ? '#ece6d3' : 'rgba(236,230,211,.35)';
      ctx.font = `700 30px ${FONT}`;
      ctx.fillText(ok ? needleName(n.id) : '?', x + 140, y + 148);
      if (ok) {
        ctx.font = `500 24px ${FONT}`;
        ctx.fillStyle = '#9fcf6b';
        ctx.fillText(needlePerk(n.id), x + 140, y + 184);
      }
    });
    tex.needsUpdate = true;
  };
  draw([]);
  return { tex, draw };
}

/** Red seven-segment-style clock over the exit, redrawn once a second. */
export function ledClock(): { tex: THREE.CanvasTexture; draw(text: string): void } {
  const W = 256, H = 80;
  const c = document.createElement('canvas');
  c.width = W; c.height = H;
  const ctx = c.getContext('2d')!;
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  const draw = (text: string) => {
    ctx.fillStyle = '#120807';
    ctx.fillRect(0, 0, W, H);
    ctx.font = `700 58px ${FONT}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = 'rgba(255,60,40,.12)';
    ctx.fillText('88:88:88', W / 2, H / 2 + 3); // unlit segments
    ctx.shadowColor = '#ff3a22';
    ctx.shadowBlur = 10;
    ctx.fillStyle = '#ff4a30';
    ctx.fillText(text, W / 2, H / 2 + 3);
    ctx.shadowBlur = 0;
    tex.needsUpdate = true;
  };
  draw('00:00:00');
  return { tex, draw };
}

/** Yellow and black warning stripes. */
export function hazardTexture(): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const ctx = c.getContext('2d')!;
  ctx.fillStyle = '#d9a91c';
  ctx.fillRect(0, 0, 128, 128);
  ctx.fillStyle = '#17150f';
  for (let i = -2; i < 4; i++) {
    ctx.beginPath();
    ctx.moveTo(i * 64, 128); ctx.lineTo(i * 64 + 32, 128); ctx.lineTo(i * 64 + 160, 0); ctx.lineTo(i * 64 + 128, 0);
    ctx.fill();
  }
  const rnd = mulberry32(3);
  for (let i = 0; i < 260; i++) { // scuffs
    ctx.fillStyle = `rgba(${rnd() < 0.5 ? '40,30,20' : '230,220,190'},${rnd() * 0.18})`;
    ctx.fillRect(rnd() * 128, rnd() * 128, 1 + rnd() * 6, 1 + rnd() * 2);
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  return tex;
}

/** Light enamel plate with dark lettering, like the sign over the exit. */
export function plateTexture(text: string): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = 512; c.height = 112;
  const ctx = c.getContext('2d')!;
  ctx.fillStyle = '#8f908a';
  ctx.fillRect(0, 0, 512, 112);
  ctx.fillStyle = '#b9b9b1';
  ctx.fillRect(6, 6, 500, 100);
  const rnd = mulberry32(9);
  for (let i = 0; i < 160; i++) { ctx.fillStyle = `rgba(60,50,40,${rnd() * 0.12})`; ctx.fillRect(rnd() * 512, rnd() * 112, 2 + rnd() * 18, 1 + rnd() * 3); }
  ctx.fillStyle = '#2b2a27';
  ctx.font = `700 56px ${FONT}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text.toUpperCase(), 256, 60);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}
