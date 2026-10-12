/**
 * Drum kit instrument — pads + strike detection (pure, unit-tested).
 *
 * Play: six pads are drawn over the camera view. Strike DOWN quickly with
 * an index fingertip (a drumstick) while it is over a pad. Either hand,
 * both at once. Strike speed sets the loudness.
 *
 * Detection: per hand, the fingertip's downward speed (screen heights per
 * second). A hit fires when the tip moves down faster than HIT_SPEED
 * inside a pad; the hand then disarms until it slows or lifts (REARM_SPEED)
 * so one stroke never double-triggers. Positions are in screen space
 * (instruments/screen.ts).
 */

export type DrumId = 'hihat' | 'tom' | 'crash' | 'snare' | 'kick' | 'floorTom';

export interface DrumPad {
  id: DrumId;
  label: string;
  /** Screen-normalized rect. */
  u0: number; v0: number; u1: number; v1: number;
}

/** Two rows of three, kept clear of the toolbar (top) and status bar. */
export const DRUM_PADS: DrumPad[] = [
  { id: 'hihat',    label: '腳踏鈸', u0: 0.04, v0: 0.16, u1: 0.32, v1: 0.44 },
  { id: 'tom',      label: '筒鼓',   u0: 0.36, v0: 0.16, u1: 0.64, v1: 0.44 },
  { id: 'crash',    label: '銅鈸',   u0: 0.68, v0: 0.16, u1: 0.96, v1: 0.44 },
  { id: 'snare',    label: '小鼓',   u0: 0.04, v0: 0.52, u1: 0.32, v1: 0.84 },
  { id: 'kick',     label: '大鼓',   u0: 0.36, v0: 0.52, u1: 0.64, v1: 0.84 },
  { id: 'floorTom', label: '落地鼓', u0: 0.68, v0: 0.52, u1: 0.96, v1: 0.84 },
];

/** Downward fingertip speed (screen heights / s) that counts as a strike. */
export const HIT_SPEED = 1.1;
/** Below this downward speed (or moving up) the hand re-arms. */
export const REARM_SPEED = 0.25;
/** Minimum gap between two hits from the same hand. */
export const MIN_HIT_GAP_MS = 90;

export function padAt(u: number, v: number): DrumPad | null {
  for (const p of DRUM_PADS) {
    if (u >= p.u0 && u <= p.u1 && v >= p.v0 && v <= p.v1) return p;
  }
  return null;
}

/** Strike speed → velocity 0.35..1. */
export function speedToVelocity(speed: number): number {
  return Math.max(0.35, Math.min(1, 0.45 + (speed - HIT_SPEED) * 0.35));
}

export interface DrumHit { pad: DrumPad; velocity: number }

interface HandTrack { u: number; v: number; t: number; armed: boolean; lastHit: number }

export class DrumHitDetector {
  private hands = new Map<string, HandTrack>();

  /**
   * Feed one fingertip sample (screen space, ms timestamp). Returns the hit
   * this sample produced, if any. Pass `null` when the hand is gone.
   */
  update(hand: string, p: { u: number; v: number } | null, t: number): DrumHit | null {
    if (!p) {
      this.hands.delete(hand);
      return null;
    }
    const prev = this.hands.get(hand);
    if (!prev) {
      this.hands.set(hand, { u: p.u, v: p.v, t, armed: true, lastHit: -Infinity });
      return null;
    }
    const dt = (t - prev.t) / 1000;
    prev.u = p.u;
    const lastV = prev.v;
    prev.v = p.v;
    prev.t = t;
    // Frame gap too short to measure, or so long the motion is stale.
    if (dt <= 0.005 || dt > 0.25) return null;

    const speed = (p.v - lastV) / dt; // + = moving down the screen
    if (!prev.armed) {
      if (speed < REARM_SPEED) prev.armed = true;
      return null;
    }
    if (speed < HIT_SPEED || t - prev.lastHit < MIN_HIT_GAP_MS) return null;
    const pad = padAt(p.u, p.v);
    if (!pad) return null;
    prev.armed = false;
    prev.lastHit = t;
    return { pad, velocity: speedToVelocity(speed) };
  }

  reset(): void {
    this.hands.clear();
  }
}
