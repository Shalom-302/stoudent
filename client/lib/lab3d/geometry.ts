import { useEffect, useMemo } from 'react';
import * as THREE from 'three';

export interface Opening {
  /** Centre de l'ouverture le long du mur. */
  center: number;
  width: number;
  /** Hauteur du bas de l'ouverture depuis le sol. */
  bottom: number;
  height: number;
}

export interface WallSegment {
  /** Centre du segment le long du mur. */
  u: number;
  /** Centre du segment en hauteur. */
  y: number;
  width: number;
  height: number;
}

/**
 * Decoupe un mur plein en segments pleins autour de ses ouvertures :
 * trumeaux pleine hauteur entre les baies, allege sous la baie, linteau au-dessus.
 * Evite le CSG tout en gardant des murs de 20 cm avec de vraies percements.
 */
export function wallSegments(length: number, height: number, openings: Opening[]): WallSegment[] {
  const sorted = [...openings].sort((a, b) => a.center - b.center);
  const segments: WallSegment[] = [];
  let cursor = -length / 2;

  for (const o of sorted) {
    const left = o.center - o.width / 2;
    const right = o.center + o.width / 2;

    if (left > cursor) {
      segments.push({ u: (cursor + left) / 2, y: height / 2, width: left - cursor, height });
    }
    if (o.bottom > 0) {
      segments.push({ u: o.center, y: o.bottom / 2, width: o.width, height: o.bottom });
    }
    const top = o.bottom + o.height;
    if (top < height) {
      segments.push({ u: o.center, y: (top + height) / 2, width: o.width, height: height - top });
    }
    cursor = right;
  }

  if (cursor < length / 2) {
    segments.push({ u: (cursor + length / 2) / 2, y: height / 2, width: length / 2 - cursor, height });
  }
  return segments;
}

/**
 * Texture dessinee au canvas, redessinee quand `deps` change.
 * Sert aux ecrans : grand ecran pedagogique, oscilloscopes, analyseur, tableau.
 */
export function useCanvasTexture(
  width: number,
  height: number,
  draw: (ctx: CanvasRenderingContext2D, w: number, h: number) => void,
  deps: unknown[],
) {
  const { canvas, texture } = useMemo(() => {
    const c = document.createElement('canvas');
    c.width = width;
    c.height = height;
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = 4;
    return { canvas: c, texture: t };
  }, [width, height]);

  useEffect(() => {
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, width, height);
    draw(ctx, width, height);
    texture.needsUpdate = true;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  useEffect(() => () => texture.dispose(), [texture]);

  return texture;
}

/** Cable avec affaissement, entre deux points. */
export function cableCurve(
  from: [number, number, number],
  to: [number, number, number],
  sag = 0.12,
): THREE.CatmullRomCurve3 {
  const a = new THREE.Vector3(...from);
  const b = new THREE.Vector3(...to);
  const m1 = a.clone().lerp(b, 0.33);
  const m2 = a.clone().lerp(b, 0.66);
  m1.y -= sag;
  m2.y -= sag * 0.8;
  return new THREE.CatmullRomCurve3([a, m1, m2, b]);
}
