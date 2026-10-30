import * as THREE from 'three';

/**
 * Labo Terrain surfaces, painted on canvases at load: no image to download,
 * and every texture is drawn once and shared. Sizes stay small (256-512 px)
 * for entry-level phones.
 *
 * Texture space is "one tile = TILE metres" (see the UVs in city-mesh), so a
 * window is the size of a window on every building.
 */

const cache = new Map<string, THREE.Texture>();

function paint(key: string, size: number, draw: (ctx: CanvasRenderingContext2D, s: number) => void, repeat = true) {
  const hit = cache.get(key);
  if (hit) return hit;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  draw(ctx, size);
  const texture = new THREE.CanvasTexture(canvas);
  if (repeat) texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  cache.set(key, texture);
  return texture;
}

/** Deterministic noise so every student sees the same stains. */
function rng(seed: number) {
  let a = seed;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function speckle(ctx: CanvasRenderingContext2D, s: number, count: number, alpha: number, seed: number, light = false) {
  const r = rng(seed);
  for (let i = 0; i < count; i++) {
    const v = light ? 255 : 0;
    ctx.fillStyle = `rgba(${v},${v},${v},${r() * alpha})`;
    const d = 1 + r() * 2;
    ctx.fillRect(r() * s, r() * s, d, d);
  }
}

/** Worn asphalt: grain, darker tyre tracks, a few patched cracks. 1 tile = 8 m. */
export function asphalt() {
  return paint('asphalt', 512, (ctx, s) => {
    ctx.fillStyle = '#4a4c4e';
    ctx.fillRect(0, 0, s, s);
    speckle(ctx, s, 9000, 0.25, 1);
    speckle(ctx, s, 3000, 0.12, 2, true);
    // traces de pneus
    ctx.fillStyle = 'rgba(20,20,22,0.10)';
    for (const y of [0.18, 0.32, 0.68, 0.82]) ctx.fillRect(0, y * s, s, s * 0.06);
    // fissures rebouchées au bitume
    const r = rng(3);
    ctx.strokeStyle = 'rgba(25,25,27,0.55)';
    ctx.lineWidth = 2;
    for (let i = 0; i < 6; i++) {
      ctx.beginPath();
      let x = r() * s;
      let y = r() * s;
      ctx.moveTo(x, y);
      for (let k = 0; k < 6; k++) {
        x += (r() - 0.5) * 60;
        y += (r() - 0.5) * 60;
        ctx.lineTo(x, y);
      }
      ctx.stroke();
    }
  });
}

/** Concrete pavers 40 x 40 cm with dirty joints. 1 tile = 2 m. */
export function pavers() {
  return paint('pavers', 256, (ctx, s) => {
    ctx.fillStyle = '#bdb5a6';
    ctx.fillRect(0, 0, s, s);
    const n = 5;
    const step = s / n;
    const r = rng(4);
    for (let i = 0; i < n; i++)
      for (let j = 0; j < n; j++) {
        const g = 170 + Math.floor(r() * 25);
        ctx.fillStyle = `rgb(${g},${g - 6},${g - 16})`;
        ctx.fillRect(i * step + 2, j * step + 2, step - 4, step - 4);
      }
    speckle(ctx, s, 2500, 0.18, 5);
    ctx.fillStyle = 'rgba(80,70,55,0.18)';
    for (let k = 0; k < 4; k++) ctx.fillRect(r() * s, r() * s, 30 + r() * 40, 20 + r() * 30);
  });
}

/** Red laterite with tufts of dry grass. 1 tile = 10 m. */
export function laterite() {
  return paint('laterite', 512, (ctx, s) => {
    ctx.fillStyle = '#a8764a';
    ctx.fillRect(0, 0, s, s);
    const r = rng(6);
    for (let i = 0; i < 40; i++) {
      const g = ctx.createRadialGradient(0, 0, 0, 0, 0, 40 + r() * 60);
      const tone = r() < 0.5 ? '150,95,55' : '120,110,60';
      g.addColorStop(0, `rgba(${tone},0.35)`);
      g.addColorStop(1, `rgba(${tone},0)`);
      ctx.save();
      ctx.translate(r() * s, r() * s);
      ctx.fillStyle = g;
      ctx.fillRect(-100, -100, 200, 200);
      ctx.restore();
    }
    speckle(ctx, s, 12000, 0.22, 7);
    ctx.strokeStyle = 'rgba(95,105,50,0.6)';
    for (let i = 0; i < 400; i++) {
      const x = r() * s;
      const y = r() * s;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x + (r() - 0.5) * 6, y - 4 - r() * 6);
      ctx.stroke();
    }
  });
}

/**
 * Painted render with a window and a band of dirt: one tile is one bay of one
 * floor (3.2 m x 3 m). Drawn near-white so the vertex colour tints the wall.
 */
export function facade() {
  return paint('facade', 256, (ctx, s) => {
    ctx.fillStyle = '#f2f0ec';
    ctx.fillRect(0, 0, s, s);
    speckle(ctx, s, 3000, 0.08, 8);
    // coulures sous la dalle
    const r = rng(9);
    for (let i = 0; i < 14; i++) {
      const x = r() * s;
      const g = ctx.createLinearGradient(0, 0, 0, s * 0.5);
      g.addColorStop(0, 'rgba(60,55,50,0.18)');
      g.addColorStop(1, 'rgba(60,55,50,0)');
      ctx.fillStyle = g;
      ctx.fillRect(x, 0, 3 + r() * 6, s * 0.5);
    }
    // bandeau de dalle
    ctx.fillStyle = 'rgba(0,0,0,0.12)';
    ctx.fillRect(0, 0, s, s * 0.05);
    // fenêtre à persiennes, encadrement
    const wx = s * 0.28;
    const wy = s * 0.3;
    const ww = s * 0.44;
    const wh = s * 0.42;
    ctx.fillStyle = '#e4e1da';
    ctx.fillRect(wx - 6, wy - 6, ww + 12, wh + 14);
    ctx.fillStyle = '#3c4650';
    ctx.fillRect(wx, wy, ww, wh);
    ctx.fillStyle = 'rgba(160,190,210,0.35)';
    ctx.fillRect(wx + 4, wy + 4, ww / 2 - 6, wh - 8);
    ctx.strokeStyle = '#6d7b86';
    ctx.lineWidth = 3;
    for (let y = wy + 8; y < wy + wh; y += 9) {
      ctx.beginPath();
      ctx.moveTo(wx + ww / 2 + 2, y);
      ctx.lineTo(wx + ww - 2, y);
      ctx.stroke();
    }
    // appui de fenêtre et salissure dessous
    ctx.fillStyle = '#d9d5cc';
    ctx.fillRect(wx - 10, wy + wh + 6, ww + 20, 6);
    ctx.fillStyle = 'rgba(70,60,50,0.15)';
    ctx.fillRect(wx, wy + wh + 12, ww, s * 0.12);
  });
}

/** Rusty corrugated sheet metal (tôle) for low houses. 1 tile = 3 m. */
export function tinRoof() {
  return paint('tin', 256, (ctx, s) => {
    for (let x = 0; x < s; x += 8) {
      const g = ctx.createLinearGradient(x, 0, x + 8, 0);
      g.addColorStop(0, '#8d8a84');
      g.addColorStop(0.5, '#c2bfb8');
      g.addColorStop(1, '#7c7973');
      ctx.fillStyle = g;
      ctx.fillRect(x, 0, 8, s);
    }
    const r = rng(10);
    for (let i = 0; i < 30; i++) {
      ctx.fillStyle = `rgba(${130 + r() * 40},${60 + r() * 20},25,${0.15 + r() * 0.3})`;
      ctx.beginPath();
      ctx.ellipse(r() * s, r() * s, 10 + r() * 40, 6 + r() * 20, r() * 3, 0, Math.PI * 2);
      ctx.fill();
    }
  });
}

/** Flat concrete roof slab, stained. 1 tile = 4 m. */
export function roofSlab() {
  return paint('slab', 256, (ctx, s) => {
    ctx.fillStyle = '#9d9890';
    ctx.fillRect(0, 0, s, s);
    speckle(ctx, s, 6000, 0.25, 11);
    const r = rng(12);
    for (let i = 0; i < 10; i++) {
      ctx.fillStyle = `rgba(40,45,40,${0.08 + r() * 0.12})`;
      ctx.beginPath();
      ctx.ellipse(r() * s, r() * s, 20 + r() * 50, 15 + r() * 30, 0, 0, Math.PI * 2);
      ctx.fill();
    }
  });
}

/** Zebra crossing stripes on transparent ground. */
export function zebra() {
  return paint(
    'zebra',
    128,
    (ctx, s) => {
      ctx.clearRect(0, 0, s, s);
      ctx.fillStyle = 'rgba(235,232,222,0.92)';
      for (let x = 0; x < s; x += s / 4) ctx.fillRect(x + 4, 0, s / 8, s);
      speckle(ctx, s, 600, 0.3, 13);
    },
    true,
  );
}
