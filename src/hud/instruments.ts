/**
 * Live-view overlays for the drum and melody instruments, drawn on the
 * main canvas in screen space (same mapping as instruments/screen.ts, so
 * what the player sees is exactly what the hit-tests use).
 */

import { DRUM_PADS, type DrumId } from '../instruments/drums';
import { KEY_COUNT, KEY_STRIP, type MelodyKey } from '../instruments/melody';
import type { ScreenPoint } from '../instruments/screen';

const BLUE = '82, 113, 255';
const SKY = '0, 153, 255';
const FONT = 'system-ui, "Noto Sans TC", sans-serif';
/** How long a pad stays lit after a hit. */
const FLASH_MS = 220;

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  const rr = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.arcTo(x + w, y, x + w, y + h, rr);
  ctx.arcTo(x + w, y + h, x, y + h, rr);
  ctx.arcTo(x, y + h, x, y, rr);
  ctx.arcTo(x, y, x + w, y, rr);
  ctx.closePath();
}

/** Fingertip cursor (where the instrument thinks the hand is). */
function drawCursor(ctx: CanvasRenderingContext2D, p: ScreenPoint, w: number, h: number, rgb: string, s: number, filled: boolean) {
  ctx.beginPath();
  ctx.arc(p.u * w, p.v * h, 9 * s, 0, Math.PI * 2);
  ctx.fillStyle = `rgba(${rgb}, ${filled ? 0.9 : 0.25})`;
  ctx.fill();
  ctx.lineWidth = 2.5 * s;
  ctx.strokeStyle = `rgba(${rgb}, 0.95)`;
  ctx.stroke();
}

export interface DrumOverlayState {
  /** Pad id → { time of last hit (performance.now ms), velocity }. */
  flashes: Partial<Record<DrumId, { t: number; vel: number }>>;
  /** Fingertip per hand label. */
  tips: Partial<Record<'Left' | 'Right', ScreenPoint>>;
}

export function drawDrumPads(ctx: CanvasRenderingContext2D, w: number, h: number, st: DrumOverlayState, now: number) {
  const s = Math.max(0.6, Math.min(w, h) / 720);
  for (const pad of DRUM_PADS) {
    const x = pad.u0 * w;
    const y = pad.v0 * h;
    const pw = (pad.u1 - pad.u0) * w;
    const ph = (pad.v1 - pad.v0) * h;
    const f = st.flashes[pad.id];
    const k = f ? Math.max(0, 1 - (now - f.t) / FLASH_MS) * f.vel : 0;

    roundRect(ctx, x, y, pw, ph, 20 * s);
    ctx.fillStyle = `rgba(255, 255, 255, ${0.22 + 0.2 * k})`;
    ctx.fill();
    if (k > 0) {
      ctx.fillStyle = `rgba(${BLUE}, ${0.45 * k})`;
      ctx.fill();
    }
    ctx.lineWidth = (2 + 3 * k) * s;
    ctx.strokeStyle = `rgba(${BLUE}, ${0.55 + 0.45 * k})`;
    ctx.stroke();

    ctx.font = `700 ${Math.round(22 * s)}px ${FONT}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = k > 0.3 ? '#ffffff' : 'rgba(0, 0, 0, 0.78)';
    ctx.fillText(pad.label, x + pw / 2, y + ph / 2);
  }
  if (st.tips.Left) drawCursor(ctx, st.tips.Left, w, h, BLUE, s, false);
  if (st.tips.Right) drawCursor(ctx, st.tips.Right, w, h, SKY, s, false);
}

export interface MelodyOverlayState {
  keys: MelodyKey[];
  /** Hovered key index per hand. */
  hover: Partial<Record<'Left' | 'Right', number>>;
  /** Whether that hand is pinching (playing its hovered key). */
  pressed: Partial<Record<'Left' | 'Right', boolean>>;
  points: Partial<Record<'Left' | 'Right', ScreenPoint>>;
}

export function drawMelodyKeys(ctx: CanvasRenderingContext2D, w: number, h: number, st: MelodyOverlayState) {
  const s = Math.max(0.6, Math.min(w, h) / 720);
  const x0 = KEY_STRIP.u0 * w;
  const y0 = KEY_STRIP.v0 * h;
  const kw = ((KEY_STRIP.u1 - KEY_STRIP.u0) * w) / KEY_COUNT;
  const kh = (KEY_STRIP.v1 - KEY_STRIP.v0) * h;
  const gap = Math.max(2, 3 * s);

  for (let i = 0; i < st.keys.length; i++) {
    const key = st.keys[i];
    const hands = (['Left', 'Right'] as const).filter((hd) => st.hover[hd] === i);
    const playing = hands.some((hd) => st.pressed[hd]);
    const hovered = hands.length > 0;
    const rgb = hands.includes('Right') && !hands.includes('Left') ? SKY : BLUE;
    const x = x0 + i * kw + gap / 2;

    roundRect(ctx, x, y0 + (playing ? 4 * s : 0), kw - gap, kh, 12 * s);
    ctx.fillStyle = playing ? `rgba(${rgb}, 0.85)` : hovered ? `rgba(${rgb}, 0.22)` : 'rgba(255, 255, 255, 0.72)';
    ctx.fill();
    ctx.lineWidth = (playing || hovered ? 2.5 : 1.5) * s;
    ctx.strokeStyle = playing || hovered ? `rgba(${rgb}, 0.95)` : 'rgba(0, 0, 0, 0.12)';
    ctx.stroke();

    const cx = x + (kw - gap) / 2;
    const fg = playing ? '#ffffff' : 'rgba(0, 0, 0, 0.82)';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = fg;
    ctx.font = `800 ${Math.round(Math.min(26 * s, kw * 0.45))}px ${FONT}`;
    ctx.fillText(String(key.degree), cx, y0 + kh * 0.42 + (playing ? 4 * s : 0));
    // 簡譜 octave dots above the number: none / one / two.
    for (let d = 0; d < key.octave; d++) {
      ctx.beginPath();
      ctx.arc(cx + (d - (key.octave - 1) / 2) * 7 * s, y0 + kh * 0.16 + (playing ? 4 * s : 0), 2.4 * s, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.font = `600 ${Math.round(Math.min(13 * s, kw * 0.28))}px ${FONT}`;
    ctx.fillStyle = playing ? 'rgba(255,255,255,0.9)' : 'rgba(0, 0, 0, 0.5)';
    ctx.fillText(key.name, cx, y0 + kh * 0.82 + (playing ? 4 * s : 0));
  }

  if (st.points.Left) drawCursor(ctx, st.points.Left, w, h, BLUE, s, !!st.pressed.Left);
  if (st.points.Right) drawCursor(ctx, st.points.Right, w, h, SKY, s, !!st.pressed.Right);
}
