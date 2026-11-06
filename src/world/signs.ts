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

function woodGrain(ctx: CanvasRenderingContext2D, W: number, H: number, base: string, dark: string): void {
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, W, H);
  for (let x = 0; x < W; x += 96 + Math.random() * 40) { // vertical planks
    ctx.fillStyle = dark;
    ctx.fillRect(x, 0, 3, H);
  }
  for (let i = 0; i < 700; i++) {
    ctx.fillStyle = `rgba(60,45,25,${Math.random() * 0.09})`;
    ctx.fillRect(Math.random() * W, Math.random() * H, 20 + Math.random() * 90, 1 + Math.random() * 2);
  }
}

/** Wide whitewashed board with dark lettering: the supply stall sign, price tags, HAY IN. */
export function signTextureLight(text: string, sub?: string): THREE.CanvasTexture {
  const W = sub ? 1024 : 384, H = sub ? 288 : 160;
  const c = document.createElement('canvas');
  c.width = W; c.height = H;
  const ctx = c.getContext('2d')!;
  woodGrain(ctx, W, H, '#d3c5a2', '#b3a179');
  ctx.strokeStyle = 'rgba(60,45,25,.5)';
  ctx.lineWidth = 8;
  ctx.strokeRect(6, 6, W - 12, H - 12);
  ctx.fillStyle = '#38291a';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  if (sub) {
    ctx.font = `700 128px ${FONT}`;
    ctx.fillText(text, W / 2, H / 2 - 42);
    ctx.font = `500 40px ${FONT}`;
    ctx.fillText(sub, W / 2, H / 2 + 74);
    // Wheat ears flanking the title, like the reference.
    for (const sx of [0.115, 0.885]) {
      ctx.strokeStyle = '#38291a';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(W * sx, H / 2 - 90);
      ctx.lineTo(W * sx, H / 2 + 6);
      ctx.stroke();
      for (let k = 0; k < 6; k++) {
        const y = H / 2 - 84 + k * 16;
        ctx.beginPath();
        ctx.moveTo(W * sx, y);
        ctx.lineTo(W * sx + (sx < 0.5 ? -1 : 1) * 22, y - 12);
        ctx.moveTo(W * sx, y + 8);
        ctx.lineTo(W * sx + (sx < 0.5 ? -1 : 1) * 22, y - 4);
        ctx.stroke();
      }
    }
  } else {
    let size = 72;
    do ctx.font = `700 ${size}px ${FONT}`; while (ctx.measureText(text).width > W - 56 && --size > 24);
    ctx.fillText(text, W / 2, H / 2 + 4);
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

/** Big dark board with huge lettering: the SELL HAY sign across the whole kiosk. */
export function bigSignTexture(text: string): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = 1024; c.height = 256;
  const ctx = c.getContext('2d')!;
  ctx.fillStyle = '#241c12';
  ctx.fillRect(0, 0, 1024, 256);
  for (let x = 0; x < 1024; x += 130) {
    ctx.fillStyle = 'rgba(0,0,0,.35)';
    ctx.fillRect(x, 0, 4, 256);
  }
  for (let i = 0; i < 500; i++) {
    ctx.fillStyle = `rgba(236,230,211,${Math.random() * 0.05})`;
    ctx.fillRect(Math.random() * 1024, Math.random() * 256, 30 + Math.random() * 80, 1 + Math.random() * 2);
  }
  ctx.fillStyle = '#e8e1cd';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  let size = 168;
  do ctx.font = `700 ${size}px ${FONT}`; while (ctx.measureText(text).width > 950 && --size > 80);
  ctx.fillText(text, 512, 132);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

/** Dark A-frame listing every shop price, like the reference PRICES board. */
export function priceListTexture(): THREE.CanvasTexture {
  const W = 256, H = 384;
  const c = document.createElement('canvas');
  c.width = W; c.height = H;
  const ctx = c.getContext('2d')!;
  ctx.fillStyle = '#202622';
  ctx.fillRect(0, 0, W, H);
  for (let i = 0; i < 500; i++) {
    ctx.fillStyle = `rgba(236,230,211,${Math.random() * 0.05})`;
    ctx.fillRect(Math.random() * W, Math.random() * H, 2 + Math.random() * 10, 1 + Math.random() * 2);
  }
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = '#ece6d3';
  ctx.font = `700 34px ${FONT}`;
  ctx.fillText(t('shop.prices').toUpperCase(), W / 2, 40);
  ctx.fillRect(W / 2 - 56, 64, 112, 3);
  ctx.textAlign = 'left';
  SHOP_ITEMS.forEach((item, i) => {
    const y = 104 + i * 46;
    ctx.fillStyle = '#ece6d3';
    ctx.font = `italic 500 24px ${FONT}`;
    ctx.fillText(t(`item.${item.id}`), 20, y);
    ctx.textAlign = 'right';
    ctx.font = `italic 700 26px ${FONT}`;
    ctx.fillText(`$${item.price}`, W - 20, y);
    ctx.textAlign = 'left';
  });
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

/** Small whitewashed price tag for the front of a counter. */
export function tagTexture(name: string, price: string): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = 256; c.height = 128;
  const ctx = c.getContext('2d')!;
  woodGrain(ctx, 256, 128, '#cfc19d', '#ab9770');
  ctx.strokeStyle = 'rgba(60,45,25,.5)';
  ctx.lineWidth = 6;
  ctx.strokeRect(4, 4, 248, 120);
  ctx.fillStyle = '#38291a';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  let size = 30;
  do ctx.font = `500 ${size}px ${FONT}`; while (ctx.measureText(name).width > 220 && --size > 14);
  ctx.fillText(name, 128, 42);
  ctx.font = `700 44px ${FONT}`;
  ctx.fillText(price, 128, 92);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

/** Dial face of the platform scale: needle at zero, a small readout window. */
export function dialTexture(): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const ctx = c.getContext('2d')!;
  ctx.fillStyle = '#d9d4c4';
  ctx.beginPath();
  ctx.arc(128, 128, 128, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#33302a';
  ctx.lineWidth = 10;
  ctx.beginPath();
  ctx.arc(128, 128, 120, 0, Math.PI * 2);
  ctx.stroke();
  for (let i = 0; i < 24; i++) {
    const a = (i / 24) * Math.PI * 2;
    ctx.strokeStyle = i % 6 ? '#33302a' : '#a33326';
    ctx.lineWidth = i % 6 ? 3 : 6;
    ctx.beginPath();
    ctx.moveTo(128 + Math.cos(a) * 96, 128 + Math.sin(a) * 96);
    ctx.lineTo(128 + Math.cos(a) * 112, 128 + Math.sin(a) * 112);
    ctx.stroke();
  }
  ctx.strokeStyle = '#1d1c19';
  ctx.lineWidth = 7;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(128, 128);
  ctx.lineTo(128, 34);
  ctx.stroke();
  ctx.fillStyle = '#1d1c19';
  ctx.beginPath();
  ctx.arc(128, 128, 12, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#27332b';
  ctx.fillRect(88, 150, 80, 40);
  ctx.fillStyle = '#9fd06a';
  ctx.font = `700 30px ${FONT}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('0.000', 128, 171);
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
    const tone = ok ? '#e8edf0' : 'rgba(236,230,211,.32)';
    ctx.strokeStyle = tone;
    ctx.fillStyle = ok ? (id === 'desk_pin' ? '#c8382c' : id === 'hat_pin' ? '#f2e6d8' : '#e8edf0') : tone;
    ctx.lineCap = 'round';
    ctx.lineWidth = id === 'darning' ? 8 : 6;
    ctx.beginPath();
    if (id === 'bent_pin') { ctx.moveTo(-52, 0); ctx.lineTo(20, 0); ctx.lineTo(58, -24); } // ball head, bent tip
    else if (id === 'safety_pin') { ctx.moveTo(60, -6); ctx.lineTo(-50, -6); ctx.arc(-50, 4, 10, -Math.PI / 2, Math.PI / 2, true); ctx.lineTo(60, 14); }
    else if (id === 'desk_pin') { ctx.moveTo(-38, 0); ctx.lineTo(60, 0); } // flat head, short point
    else { ctx.moveTo(-70, 0); ctx.lineTo(70, 0); }
    ctx.stroke();
    ctx.beginPath();
    if (id === 'bent_pin') ctx.arc(-62, 0, 9, 0, Math.PI * 2);
    else if (id === 'desk_pin') { ctx.ellipse(-48, 0, 9, 26, 0, 0, Math.PI * 2); ctx.fill(); }
    else if (id === 'hat_pin') ctx.arc(-72, 0, 16, 0, Math.PI * 2);
    else if (id === 'safety_pin') ctx.rect(56, -12, 18, 30);
    if (id !== 'sewing' && id !== 'darning' && id !== 'desk_pin') ctx.fill();
    if (id === 'sewing' || id === 'darning') { ctx.lineWidth = 3.5; ctx.ellipse(-60, 0, 8, 3.5, 0, 0, Math.PI * 2); ctx.stroke(); }
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
