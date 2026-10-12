/**
 * Finger-extension classification (pure — unit-tested without MediaPipe).
 *
 * Index / middle / ring keep the original tip-above-PIP test. The pinky
 * gets a stricter test (2026-10-12): it is the shortest finger, so a
 * half-curled pinky often still has its tip above its PIP, and the plain
 * Y test read "index only" as "index + pinky" (= chord VI). An extended
 * pinky must now also be STRAIGHT (MCP→PIP vs PIP→tip angle) and REACH
 * away from the wrist (tip clearly farther than the PIP).
 */

import type { LandmarkPoint } from './types';

/** Max bend (degrees) between the pinky's MCP→PIP and PIP→tip segments. */
export const PINKY_MAX_BEND_DEG = 45;
/** Pinky tip must be this many times farther from the wrist than its PIP. */
export const PINKY_MIN_REACH = 1.15;

interface V2 { x: number; y: number }

/** Landmarks are normalized per axis (x by video width, y by height);
 *  `aspect` = width / height restores true proportions for geometry. */
const toV = (p: LandmarkPoint, aspect: number): V2 => ({ x: p.x * aspect, y: p.y });
const sub = (a: V2, b: V2): V2 => ({ x: a.x - b.x, y: a.y - b.y });
const len = (v: V2): number => Math.hypot(v.x, v.y);

function bendDeg(a: V2, b: V2): number {
  const la = len(a);
  const lb = len(b);
  if (la === 0 || lb === 0) return 180;
  const cos = Math.max(-1, Math.min(1, (a.x * b.x + a.y * b.y) / (la * lb)));
  return (Math.acos(cos) * 180) / Math.PI;
}

export function isPinkyExtended(pts: LandmarkPoint[], aspect = 1): boolean {
  if (pts[20].y >= pts[18].y) return false; // original test: tip above PIP
  const wrist = toV(pts[0], aspect);
  const mcp = toV(pts[17], aspect);
  const pip = toV(pts[18], aspect);
  const tip = toV(pts[20], aspect);
  if (len(sub(tip, wrist)) < len(sub(pip, wrist)) * PINKY_MIN_REACH) return false;
  return bendDeg(sub(pip, mcp), sub(tip, pip)) <= PINKY_MAX_BEND_DEG;
}

/**
 * Which fingers are extended on one hand.
 * Thumb: horizontal comparison with handedness awareness.
 * Index/middle/ring: fingertip above PIP joint.
 * Pinky: see isPinkyExtended.
 */
export function getExtendedFingers(pts: LandmarkPoint[], label: 'Left' | 'Right', aspect = 1): string[] {
  const extended: string[] = [];

  // For right hand: thumb extends right (tip.x > ip.x); left hand: left.
  const thumbTip = pts[4];
  const thumbIp = pts[3];
  const thumbExtended = label === 'Right' ? thumbTip.x > thumbIp.x : thumbTip.x < thumbIp.x;
  if (thumbExtended) extended.push('thumb');

  const standardFingers: [number, number, string][] = [
    [8, 6, 'index'],
    [12, 10, 'middle'],
    [16, 14, 'ring'],
  ];
  for (const [tipIdx, pipIdx, name] of standardFingers) {
    if (pts[tipIdx].y < pts[pipIdx].y) extended.push(name);
  }

  if (isPinkyExtended(pts, aspect)) extended.push('pinky');

  return extended;
}
