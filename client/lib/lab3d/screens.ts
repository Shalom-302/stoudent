/**
 * Dessin des ecrans. Un seul endroit pour tout ce qui s'affiche sur une surface :
 * ecrans d'instruments, grand ecran pedagogique, tableau blanc.
 */

import { PALETTE } from './specs';
import {
  HARMONICS,
  formatFrequency,
  fullScale,
  spectrum,
  trace,
  WAVEFORM_LABELS,
  type SignalSettings,
} from './signal';

const MONO = '"IBM Plex Mono", ui-monospace, monospace';
const SANS = '"IBM Plex Sans", system-ui, sans-serif';

function graticule(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, cols = 10, rows = 8) {
  ctx.save();
  ctx.strokeStyle = 'rgba(148,163,171,0.22)';
  ctx.lineWidth = 1;
  for (let i = 1; i < cols; i++) {
    ctx.beginPath();
    ctx.moveTo(x + (w * i) / cols, y);
    ctx.lineTo(x + (w * i) / cols, y + h);
    ctx.stroke();
  }
  for (let i = 1; i < rows; i++) {
    ctx.beginPath();
    ctx.moveTo(x, y + (h * i) / rows);
    ctx.lineTo(x + w, y + (h * i) / rows);
    ctx.stroke();
  }
  ctx.strokeStyle = 'rgba(148,163,171,0.45)';
  ctx.beginPath();
  ctx.moveTo(x, y + h / 2);
  ctx.lineTo(x + w, y + h / 2);
  ctx.moveTo(x + w / 2, y);
  ctx.lineTo(x + w / 2, y + h);
  ctx.stroke();
  ctx.restore();
}

export function drawWaveform(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  signal: SignalSettings,
  color = PALETTE.accent,
  periods = 2,
) {
  const pts = trace(signal, periods, 420);
  const scale = fullScale(signal);
  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = Math.max(2, h / 90);
  ctx.lineJoin = 'round';
  ctx.shadowColor = color;
  ctx.shadowBlur = h / 40;
  ctx.beginPath();
  pts.forEach((v, i) => {
    const px = x + (i / (pts.length - 1)) * w;
    const py = y + h / 2 - (v / scale) * (h / 2) * 0.92;
    i === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py);
  });
  ctx.stroke();
  ctx.restore();
}

/** Ecran d'oscilloscope : graticule, trace, bandeau de reglages. */
export function drawScope(ctx: CanvasRenderingContext2D, w: number, h: number, signal: SignalSettings) {
  ctx.fillStyle = PALETTE.screenOn;
  ctx.fillRect(0, 0, w, h);

  const pad = w * 0.04;
  const bar = h * 0.16;
  const gw = w - pad * 2;
  const gh = h - bar - pad * 2;

  graticule(ctx, pad, pad, gw, gh);
  drawWaveform(ctx, pad, pad, gw, gh, signal);

  ctx.fillStyle = 'rgba(255,255,255,0.06)';
  ctx.fillRect(0, h - bar, w, bar);
  ctx.fillStyle = '#9fb0b8';
  ctx.font = `500 ${Math.round(h * 0.085)}px ${MONO}`;
  ctx.fillText(`CH1  ${(fullScale(signal) / 4).toFixed(2)} V/div`, pad, h - bar * 0.35);
  ctx.textAlign = 'right';
  ctx.fillStyle = PALETTE.accentSoft;
  ctx.fillText(formatFrequency(signal.frequency), w - pad, h - bar * 0.35);
  ctx.textAlign = 'left';
}

/** Afficheur du generateur de fonctions. */
export function drawGenerator(ctx: CanvasRenderingContext2D, w: number, h: number, signal: SignalSettings) {
  ctx.fillStyle = '#0b1a16';
  ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = '#7ee0b0';
  ctx.font = `600 ${Math.round(h * 0.42)}px ${MONO}`;
  ctx.fillText(formatFrequency(signal.frequency), w * 0.05, h * 0.52);
  ctx.font = `400 ${Math.round(h * 0.24)}px ${MONO}`;
  ctx.fillStyle = '#4e9e7d';
  ctx.fillText(`${WAVEFORM_LABELS[signal.waveform]}  ${signal.amplitude.toFixed(1)} Vpp`, w * 0.05, h * 0.86);
}

/** Alimentation stabilisee : afficheurs V et A. */
export function drawPowerSupply(ctx: CanvasRenderingContext2D, w: number, h: number) {
  ctx.fillStyle = '#140d0d';
  ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = '#e06a4a';
  ctx.font = `600 ${Math.round(h * 0.36)}px ${MONO}`;
  ctx.fillText('12.00 V', w * 0.06, h * 0.45);
  ctx.fillText('0.42 A', w * 0.06, h * 0.9);
}

/** Analyseur de spectre : raies amplitude / frequence. */
export function drawSpectrum(ctx: CanvasRenderingContext2D, w: number, h: number, signal: SignalSettings) {
  ctx.fillStyle = PALETTE.screenOn;
  ctx.fillRect(0, 0, w, h);

  const pad = w * 0.05;
  const base = h * 0.82;
  const gw = w - pad * 2;
  const gh = base - h * 0.12;

  graticule(ctx, pad, h * 0.12, gw, gh, 10, 6);

  const lines = spectrum(signal);
  const max = Math.max(...lines.map((l) => l.amplitude), 0.01);
  const slot = gw / (HARMONICS.length + 1);

  lines.forEach((l, i) => {
    const x = pad + slot * (i + 1);
    const bh = (l.amplitude / max) * gh * 0.9;
    ctx.fillStyle = l.active ? PALETTE.accent : 'rgba(150,160,168,0.28)';
    ctx.fillRect(x - w * 0.012, base - bh, w * 0.024, bh);
    ctx.fillStyle = l.active ? '#c9d3d8' : 'rgba(150,160,168,0.45)';
    ctx.font = `500 ${Math.round(h * 0.075)}px ${MONO}`;
    ctx.textAlign = 'center';
    ctx.fillText(`H${l.harmonic}`, x, h * 0.95);
  });

  ctx.textAlign = 'left';
  ctx.fillStyle = '#9fb0b8';
  ctx.font = `500 ${Math.round(h * 0.075)}px ${MONO}`;
  ctx.fillText(`Span 0 — ${formatFrequency(signal.frequency * 10)}`, pad, h * 0.085);
}

/** What the room is currently teaching, pushed from the running TP. */
export interface LessonContext {
  title: string;
  /** 1-based, e.g. "etape 2 / 4". */
  step: number;
  steps: number;
  stepTitle: string;
  instruction: string;
  /** Live reading, shown large: what to watch while turning the knob. */
  readout?: { label: string; value: string };
  /** Manipulations still to do, so the wall answers "what now?". */
  todo?: string[];
  formula?: string;
  note?: string;
}

/** Grand ecran pedagogique — TP en cours (section 10). */
export function drawLesson(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  signal: SignalSettings,
  lesson?: LessonContext,
) {
  ctx.fillStyle = '#14181c';
  ctx.fillRect(0, 0, w, h);

  // bandeau
  ctx.fillStyle = PALETTE.accent;
  ctx.fillRect(0, 0, w, h * 0.012);

  ctx.fillStyle = '#f5f3ef';
  ctx.font = `600 ${Math.round(h * 0.085)}px ${SANS}`;
  ctx.fillText('SignalLab', w * 0.05, h * 0.14);
  ctx.fillStyle = '#8d979d';
  ctx.font = `400 ${Math.round(h * 0.055)}px ${SANS}`;
  ctx.fillText(
    lesson ? `${lesson.title} — etape ${lesson.step} / ${lesson.steps}` : 'Salle de travaux pratiques',
    w * 0.05,
    h * 0.215,
  );

  // trace
  const gx = w * 0.05;
  const gy = h * 0.28;
  const gw = w * 0.56;
  const gh = h * 0.5;
  ctx.fillStyle = '#0d1114';
  ctx.fillRect(gx, gy, gw, gh);
  graticule(ctx, gx, gy, gw, gh);
  drawWaveform(ctx, gx, gy, gw, gh, signal);

  if (lesson) {
    const px = w * 0.66;
    ctx.fillStyle = PALETTE.accent;
    ctx.font = `600 ${Math.round(h * 0.05)}px ${SANS}`;
    wrapText(ctx, lesson.stepTitle, px, gy + h * 0.05, w * 0.3, h * 0.058);

    ctx.fillStyle = '#d7dde1';
    ctx.font = `400 ${Math.round(h * 0.042)}px ${SANS}`;
    const afterInstruction = wrapText(
      ctx,
      lesson.instruction,
      px,
      gy + h * 0.13,
      w * 0.3,
      h * 0.05,
    );

    let cursor = afterInstruction + h * 0.03;
    if (lesson.readout) {
      ctx.fillStyle = '#8d979d';
      ctx.font = `400 ${Math.round(h * 0.036)}px ${SANS}`;
      ctx.fillText(lesson.readout.label, px, cursor);
      ctx.fillStyle = '#f5f3ef';
      ctx.font = `600 ${Math.round(h * 0.075)}px ${MONO}`;
      ctx.fillText(lesson.readout.value, px, cursor + h * 0.075);
      cursor += h * 0.12;
    }

    for (const item of (lesson.todo ?? []).slice(0, 3)) {
      ctx.fillStyle = '#6d7479';
      ctx.font = `400 ${Math.round(h * 0.034)}px ${SANS}`;
      ctx.fillText('•', px, cursor);
      cursor = wrapText(ctx, item, px + w * 0.018, cursor, w * 0.28, h * 0.042) + h * 0.012;
    }

    ctx.fillStyle = '#6d7479';
    ctx.font = `400 ${Math.round(h * 0.036)}px ${SANS}`;
    ctx.fillText(
      'Les reglages du poste mettent cet ecran a jour en direct.',
      w * 0.05,
      h * 0.92,
    );
    return;
  }

  // parametres
  const px = w * 0.66;
  ctx.fillStyle = '#8d979d';
  ctx.font = `400 ${Math.round(h * 0.042)}px ${SANS}`;
  ctx.fillText('Signal', px, gy + h * 0.045);
  ctx.fillText('Frequence fondamentale', px, gy + h * 0.155);
  ctx.fillText('Harmoniques retenues', px, gy + h * 0.265);

  ctx.fillStyle = '#f5f3ef';
  ctx.font = `500 ${Math.round(h * 0.055)}px ${MONO}`;
  ctx.fillText(WAVEFORM_LABELS[signal.waveform], px, gy + h * 0.105);
  ctx.fillText(formatFrequency(signal.frequency), px, gy + h * 0.215);

  HARMONICS.forEach((n, i) => {
    const bx = px + (i % 3) * w * 0.1;
    const by = gy + h * 0.325 + Math.floor(i / 3) * h * 0.075;
    const on = signal.harmonics[n];
    ctx.strokeStyle = on ? PALETTE.accent : '#4a5257';
    ctx.lineWidth = Math.max(1, h * 0.004);
    ctx.strokeRect(bx, by, h * 0.045, h * 0.045);
    if (on) {
      ctx.fillStyle = PALETTE.accent;
      ctx.fillRect(bx + h * 0.011, by + h * 0.011, h * 0.023, h * 0.023);
    }
    ctx.fillStyle = on ? '#f5f3ef' : '#6d7479';
    ctx.font = `500 ${Math.round(h * 0.042)}px ${MONO}`;
    ctx.fillText(`H${n}`, bx + h * 0.06, by + h * 0.038);
  });

  ctx.fillStyle = '#6d7479';
  ctx.font = `400 ${Math.round(h * 0.036)}px ${SANS}`;
  ctx.fillText('Approchez un poste et appuyez sur E pour regler le generateur.', w * 0.05, h * 0.92);
}

/** Tableau blanc — le repere de cours du TP en cours, sinon les generalites. */
export function drawWhiteboard(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  lesson?: LessonContext,
) {
  ctx.fillStyle = '#f7f7f4';
  ctx.fillRect(0, 0, w, h);

  ctx.strokeStyle = '#2f5fa8';
  ctx.lineWidth = 3;
  ctx.font = `400 ${Math.round(h * 0.09)}px ${SANS}`;
  ctx.fillStyle = '#2f5fa8';
  ctx.fillText(lesson?.title ?? 'x(t)  ->  X(f)', w * 0.06, h * 0.18);

  if (lesson?.formula) {
    // A TP is running: the board carries its formula, hand-written style,
    // instead of generic decoration.
    ctx.fillStyle = '#1f2933';
    ctx.font = `400 ${Math.round(h * 0.1)}px ${MONO}`;
    const after = wrapText(ctx, lesson.formula, w * 0.06, h * 0.4, w * 0.88, h * 0.13);
    if (lesson.note) {
      ctx.fillStyle = '#5b6570';
      ctx.font = `400 ${Math.round(h * 0.07)}px ${SANS}`;
      wrapText(ctx, lesson.note, w * 0.06, after + h * 0.08, w * 0.88, h * 0.09);
    }
    return;
  }

  // petit axe temporel
  ctx.beginPath();
  ctx.moveTo(w * 0.07, h * 0.5);
  ctx.lineTo(w * 0.42, h * 0.5);
  ctx.stroke();
  ctx.beginPath();
  for (let i = 0; i <= 60; i++) {
    const x = w * 0.07 + (i / 60) * w * 0.35;
    const y = h * 0.5 - Math.sin((i / 60) * Math.PI * 4) * h * 0.11;
    i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
  }
  ctx.stroke();

  // raies spectrales
  ctx.strokeStyle = '#1f7a5c';
  ctx.beginPath();
  ctx.moveTo(w * 0.56, h * 0.62);
  ctx.lineTo(w * 0.94, h * 0.62);
  ctx.stroke();
  [0.2, 0.42, 0.62, 0.78].forEach((f, i) => {
    const x = w * 0.56 + f * w * 0.36;
    ctx.beginPath();
    ctx.moveTo(x, h * 0.62);
    ctx.lineTo(x, h * 0.62 - (h * 0.32) / (i + 1));
    ctx.stroke();
  });

  ctx.fillStyle = '#3d4248';
  ctx.font = `400 ${Math.round(h * 0.07)}px ${SANS}`;
  ctx.fillText('fe > 2 fmax   (Nyquist)', w * 0.06, h * 0.88);
}


/** Wrap `text` inside `maxWidth`, returning the baseline of the last line. */
function wrapText(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  maxWidth: number,
  lineHeight: number,
): number {
  const words = String(text ?? '').split(/\s+/).filter(Boolean);
  let line = '';
  let cursor = y;
  for (const word of words) {
    const candidate = line ? `${line} ${word}` : word;
    if (ctx.measureText(candidate).width > maxWidth && line) {
      ctx.fillText(line, x, cursor);
      line = word;
      cursor += lineHeight;
    } else {
      line = candidate;
    }
  }
  if (line) ctx.fillText(line, x, cursor);
  return cursor;
}
