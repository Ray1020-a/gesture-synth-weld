/**
 * Melody instrument (主旋律 / 琴) — keys + pinch detection (pure, unit-tested).
 *
 * Play: a strip of 15 scale keys (two octaves of the major scale in the
 * toolbar key) spans the bottom of the screen. Move a hand left/right to
 * pick a key — the hovered key lights up — and PINCH thumb + index to
 * play it; hold the pinch to sustain, slide while pinched to glide to the
 * next key, open the fingers to release. Each hand is its own voice.
 *
 * Key choice follows the pinch point (midpoint of thumb + index tips) in
 * screen space, so it stays put while the fingers close.
 */

import type { LandmarkPoint } from '../types';

export const KEY_COUNT = 15;
/** Screen-normalized vertical band the key strip is drawn in. */
export const KEY_STRIP = { v0: 0.66, v1: 0.86, u0: 0.03, u1: 0.97 };

const MAJOR_STEPS = [0, 2, 4, 5, 7, 9, 11];
const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

export interface MelodyKey {
  midi: number;
  name: string;
  /** Scale degree 1..7 (簡譜 number). */
  degree: number;
  /** Octave index within the strip (0, 1, 2) — drawn as dots. */
  octave: number;
}

/** Two octaves + top tonic of the major scale starting at C4 + keyOffset. */
export function melodyKeys(keyOffset: number): MelodyKey[] {
  const root = 60 + keyOffset;
  const keys: MelodyKey[] = [];
  for (let i = 0; i < KEY_COUNT; i++) {
    const octave = Math.floor(i / 7);
    const deg = i % 7;
    const midi = root + octave * 12 + MAJOR_STEPS[deg];
    keys.push({ midi, name: NOTE_NAMES[midi % 12], degree: deg + 1, octave });
  }
  return keys;
}

/** Screen u → key index (clamped to the strip). */
export function keyIndexAt(u: number): number {
  const { u0, u1 } = KEY_STRIP;
  const f = (u - u0) / (u1 - u0);
  return Math.max(0, Math.min(KEY_COUNT - 1, Math.floor(f * KEY_COUNT)));
}

/** Pinch closes below ON and opens above OFF (hysteresis, hand-size relative). */
export const PINCH_ON = 0.3;
export const PINCH_OFF = 0.45;

/** Thumb-tip ↔ index-tip distance relative to hand size (wrist ↔ middle MCP). */
export function pinchRatio(pts: LandmarkPoint[], aspect = 1): number {
  const d = (a: LandmarkPoint, b: LandmarkPoint) => Math.hypot((a.x - b.x) * aspect, a.y - b.y);
  const size = d(pts[0], pts[9]);
  if (size === 0) return Infinity;
  return d(pts[4], pts[8]) / size;
}

/** Midpoint of thumb + index tips — the "finger on the key". */
export function pinchPoint(pts: LandmarkPoint[]): { x: number; y: number } {
  return { x: (pts[4].x + pts[8].x) / 2, y: (pts[4].y + pts[8].y) / 2 };
}

export class PinchState {
  private pinched = new Map<string, boolean>();

  /** Update with this frame's ratio; returns whether the hand is pinching. */
  update(hand: string, ratio: number | null): boolean {
    if (ratio === null) {
      this.pinched.delete(hand);
      return false;
    }
    const was = this.pinched.get(hand) ?? false;
    const now = was ? ratio < PINCH_OFF : ratio < PINCH_ON;
    this.pinched.set(hand, now);
    return now;
  }

  reset(): void {
    this.pinched.clear();
  }
}
