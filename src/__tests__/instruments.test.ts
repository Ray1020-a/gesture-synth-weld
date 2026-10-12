import { describe, it, expect } from 'vitest';
import type { LandmarkPoint } from '../types';
import { getExtendedFingers, isPinkyExtended } from '../fingers';
import { DrumHitDetector, HIT_SPEED, padAt } from '../instruments/drums';
import { KEY_COUNT, PinchState, keyIndexAt, melodyKeys, pinchRatio } from '../instruments/melody';
import { landmarkToScreen } from '../instruments/screen';

/* ─── Synthetic upright hand (y grows downward, like MediaPipe) ────────
 * Wrist at the bottom, MCPs in a row; each finger is built from its MCP
 * with explicit PIP / DIP / tip offsets so tests can bend fingers. */
type Off = [number, number];
const STRAIGHT: Off[] = [[0, -0.08], [0, -0.13], [0, -0.17]];
const CURLED: Off[] = [[0, -0.06], [0, -0.03], [0, 0.01]]; // folds back over the palm
// Half-curled: tip still above the PIP (passes the old Y test) but bent and short.
const HALF_CURLED: Off[] = [[0, -0.06], [0.02, -0.08], [0.05, -0.08]];

function hand(fingers: { index: Off[]; middle: Off[]; ring: Off[]; pinky: Off[] }, thumbOut = false): LandmarkPoint[] {
  const p = (x: number, y: number): LandmarkPoint => ({ x, y, z: 0 });
  const pts: LandmarkPoint[] = new Array(21);
  pts[0] = p(0.5, 0.9);
  // Thumb (Right hand: extended = tip right of IP).
  pts[1] = p(0.43, 0.84); pts[2] = p(0.40, 0.8); pts[3] = p(0.38, 0.77);
  pts[4] = thumbOut ? p(0.42, 0.74) : p(0.36, 0.76);
  const build = (mcpIdx: number, x: number, offs: Off[]) => {
    pts[mcpIdx] = p(x, 0.7);
    offs.forEach(([dx, dy], k) => { pts[mcpIdx + 1 + k] = p(x + dx, 0.7 + dy); });
  };
  build(5, 0.44, fingers.index);
  build(9, 0.48, fingers.middle);
  build(13, 0.52, fingers.ring);
  build(17, 0.56, fingers.pinky);
  return pts;
}

describe('pinky detection (bug 2026-10-12: index-only read as index+pinky)', () => {
  it('accepts a straight pinky', () => {
    const pts = hand({ index: STRAIGHT, middle: CURLED, ring: CURLED, pinky: STRAIGHT });
    expect(isPinkyExtended(pts)).toBe(true);
    expect(getExtendedFingers(pts, 'Right')).toEqual(['index', 'pinky']);
  });

  it('rejects a half-curled pinky whose tip is still above its PIP', () => {
    const pts = hand({ index: STRAIGHT, middle: CURLED, ring: CURLED, pinky: HALF_CURLED });
    expect(pts[20].y).toBeLessThan(pts[18].y); // the old test would have said "extended"
    expect(isPinkyExtended(pts)).toBe(false);
    expect(getExtendedFingers(pts, 'Right')).toEqual(['index']);
  });

  it('rejects a curled pinky', () => {
    const pts = hand({ index: STRAIGHT, middle: CURLED, ring: CURLED, pinky: CURLED });
    expect(isPinkyExtended(pts)).toBe(false);
  });

  it('keeps the other fingers on the tip-above-PIP rule', () => {
    const pts = hand({ index: STRAIGHT, middle: STRAIGHT, ring: STRAIGHT, pinky: STRAIGHT }, true);
    expect(getExtendedFingers(pts, 'Right')).toEqual(['thumb', 'index', 'middle', 'ring', 'pinky']);
  });
});

describe('drum hit detection', () => {
  const snare = { u: 0.18, v: 0.7 };

  it('fires once on a fast downward strike inside a pad', () => {
    const d = new DrumHitDetector();
    expect(d.update('Right', { u: snare.u, v: 0.6 }, 0)).toBeNull();
    const hit = d.update('Right', { u: snare.u, v: 0.7 }, 33); // ~3 screen heights/s
    expect(hit?.pad.id).toBe('snare');
    expect(hit!.velocity).toBeGreaterThan(0.35);
    // Still moving down: same stroke, no second hit.
    expect(d.update('Right', { u: snare.u, v: 0.8 }, 66)).toBeNull();
  });

  it('re-arms after the hand slows down', () => {
    const d = new DrumHitDetector();
    d.update('Left', { u: snare.u, v: 0.6 }, 0);
    expect(d.update('Left', { u: snare.u, v: 0.7 }, 33)).not.toBeNull();
    d.update('Left', { u: snare.u, v: 0.65 }, 66); // lift
    d.update('Left', { u: snare.u, v: 0.6 }, 200);
    expect(d.update('Left', { u: snare.u, v: 0.72 }, 233)?.pad.id).toBe('snare');
  });

  it('ignores slow motion and strikes outside pads', () => {
    const d = new DrumHitDetector();
    d.update('Right', { u: snare.u, v: 0.6 }, 0);
    const slowStep = (HIT_SPEED * 0.5 * 33) / 1000;
    expect(d.update('Right', { u: snare.u, v: 0.6 + slowStep }, 33)).toBeNull();
    const g = new DrumHitDetector();
    g.update('Right', { u: 0.34, v: 0.4 }, 0); // gap between pads
    expect(g.update('Right', { u: 0.34, v: 0.5 }, 33)).toBeNull();
  });

  it('tracks each hand separately', () => {
    const d = new DrumHitDetector();
    d.update('Left', { u: 0.18, v: 0.6 }, 0);
    d.update('Right', { u: 0.5, v: 0.6 }, 0);
    expect(d.update('Left', { u: 0.18, v: 0.7 }, 33)?.pad.id).toBe('snare');
    expect(d.update('Right', { u: 0.5, v: 0.7 }, 33)?.pad.id).toBe('kick');
  });

  it('maps every pad center back to its pad', () => {
    expect(padAt(0.18, 0.3)?.id).toBe('hihat');
    expect(padAt(0.82, 0.68)?.id).toBe('floorTom');
    expect(padAt(0.5, 0.95)).toBeNull();
  });
});

describe('melody keys + pinch', () => {
  it('builds two octaves of the major scale plus the top tonic', () => {
    const keys = melodyKeys(0);
    expect(keys).toHaveLength(KEY_COUNT);
    expect(keys.slice(0, 8).map((k) => k.name)).toEqual(['C', 'D', 'E', 'F', 'G', 'A', 'B', 'C']);
    expect(keys[0].midi).toBe(60);
    expect(keys[14].midi).toBe(84);
    expect(melodyKeys(9)[0].name).toBe('A'); // follows the toolbar key
  });

  it('maps screen x to a clamped key index', () => {
    expect(keyIndexAt(0)).toBe(0);
    expect(keyIndexAt(1)).toBe(KEY_COUNT - 1);
    expect(keyIndexAt(0.5)).toBe(7);
  });

  it('pinch uses hysteresis', () => {
    const p = new PinchState();
    expect(p.update('Right', 0.5)).toBe(false);
    expect(p.update('Right', 0.25)).toBe(true);
    expect(p.update('Right', 0.4)).toBe(true); // between ON and OFF: stays pinched
    expect(p.update('Right', 0.5)).toBe(false);
    expect(p.update('Right', null)).toBe(false);
  });

  it('measures pinch relative to hand size', () => {
    const pts = hand({ index: STRAIGHT, middle: STRAIGHT, ring: STRAIGHT, pinky: STRAIGHT });
    pts[4] = { ...pts[8] }; // thumb tip on index tip
    expect(pinchRatio(pts)).toBeCloseTo(0);
  });
});

describe('landmark → screen mapping', () => {
  it('mirrors x and applies the cover crop', () => {
    expect(landmarkToScreen({ x: 0, y: 0 }, 100, 100)).toEqual({ u: 1, v: 0 });
    // Video drawn 200 wide, offset -50: mirrored x=0.25 lands on the right edge.
    const p = landmarkToScreen({ x: 0.25, y: 0.5 }, 100, 100, { dx: -50, dy: 0, dw: 200, dh: 100 });
    expect(p.u).toBeCloseTo(1);
    expect(p.v).toBeCloseTo(0.5);
  });
});
