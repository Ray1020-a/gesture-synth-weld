/* ─── Gesture & Synth Type Definitions ───────────────────────────────── */

export interface LandmarkPoint {
  x: number;
  y: number;
  z: number;
}

export interface HandData {
  landmarks: LandmarkPoint[];
  label: 'Left' | 'Right';
  fingerCount: number;
  extendedFingers: string[];
  tiltAngle: number;
  positionY: number;
  positionX: number;
}

export interface GestureState {
  left: HandData | null;
  right: HandData | null;
}

export interface ChordDef {
  roman: string;
  label: string;
  intervals: number[];
  isMajor: boolean;
}

export type WaveformType = 'sine' | 'triangle' | 'sawtooth' | 'square';

/** App mode = the instrument being played: chords (two-hand gesture),
 *  drums (strike pads), melody (pinch scale keys) or theremin. */
export type AppMode = 'gesture' | 'drums' | 'melody' | 'theremin';

/** Display names, shared by the picker, toolbar, status bar and HUD. */
export const APP_MODE_LABELS: Record<AppMode, string> = {
  gesture: '和弦',
  drums: '鼓',
  melody: '旋律',
  theremin: '特雷門',
};

/** Left hand mode: how left hand controls harmony */
export type LeftHandMode = 'scaleTilt' | 'scaleLocked';

/** Right hand mode: how right hand controls expression */
export type RightHandMode = 'fingerLayout' | 'fixedChordStyle';

/** Arpeggiator speed */
export type ArpSpeed = 'slow' | 'normal' | 'fast';

export const ARP_SPEED_MS: Record<ArpSpeed, number> = {
  slow: 120,
  normal: 80,
  fast: 50,
};

/** Maps finger count (1-5) to diatonic chord index (0-6), cycling */
export const FINGER_TO_CHORD_INDEX: Record<number, number> = {
  0: 0,
  1: 0,
  2: 1,
  3: 2,
  4: 3,
  5: 4,
};

export interface SynthState {
  chordIndex: number;
  chordName: string;
  /** HUD display parts: root+quality (big) and right-hand extension (small) */
  chordBase: string;
  chordExt: string;
  /** Right-thumb octave-down state (HUD 8vb badge) */
  octaveDown: boolean;
  /** Active chord style this frame (drives the waveform line count) */
  chordStyle?: import('./chords').ChordStyle;
  volume: number;
  mode: 'major' | 'minor' | 'diatonicMajor' | 'diatonicMinor';
  isPlaying: boolean;
  /** Key offset in semitones (0 = C) */
  keyOffset: number;
  /** App mode */
  appMode: AppMode;
  /** Left hand mode */
  leftHandMode: LeftHandMode;
  /** Right hand mode */
  rightHandMode: RightHandMode;
  /** Locked chord style (for fixedChordStyle mode) */
  lockedChordStyle?: import('./chords').ChordStyle;
  /** Locked mode for scaleLocked left hand mode ('diatonicMajor'/'diatonicMinor' = diatonic quality per degree, major- or minor-scale-relative) */
  lockedMode?: 'major' | 'minor' | 'diatonicMajor' | 'diatonicMinor';
  /** Arpeggiator enabled */
  arpeggiate: boolean;
  /** Arpeggiator speed */
  arpSpeed: ArpSpeed;
  /** Auto bass enabled */
  autoBass: boolean;
  /** Bass volume (0-1) */
  bassVolume: number;
}

/* ─── Recording (B2) ────────────────────────────────────────────────── */

/** What the recording captures. */
export type RecMode = 'audio' | 'video' | 'skeleton';

/** Output aspect ratio for video/skeleton recordings. */
export type RecRatio = '9:16' | '16:9' | '1:1';

/** Recording flow phase. */
export type RecPhase = 'idle' | 'choosing' | 'countdown' | 'recording' | 'result';
