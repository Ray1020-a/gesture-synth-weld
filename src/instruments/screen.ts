/**
 * Landmark → screen mapping shared by the drum pads and melody keys.
 *
 * Screen space = the canvas the player sees, normalized to [0, 1] on both
 * axes (u = left→right, v = top→bottom). The live view is mirrored and the
 * video is cover-cropped into the canvas, so a landmark maps through the
 * SAME rect drawHandSkeleton uses — pads and keys line up with the drawn
 * skeleton on every aspect ratio.
 */

import type { LandmarkPoint } from '../types';

export interface CoverCrop { dx: number; dy: number; dw: number; dh: number }

export interface ScreenPoint { u: number; v: number }

export function landmarkToScreen(
  lm: Pick<LandmarkPoint, 'x' | 'y'>,
  canvasW: number,
  canvasH: number,
  crop?: CoverCrop,
): ScreenPoint {
  const { dx = 0, dy = 0, dw = canvasW, dh = canvasH } = crop ?? {};
  return {
    u: (dx + dw * (1 - lm.x)) / canvasW,
    v: (dy + dh * lm.y) / canvasH,
  };
}

/** Viewport the instruments live in — App keeps the latest one per frame. */
export interface ScreenFrame { w: number; h: number; crop?: CoverCrop }
