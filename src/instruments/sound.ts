/**
 * Tone.js voices for the drum kit and the melody instrument.
 *
 * Everything is synthesized (no samples to download — the hand model is
 * already the one big asset). Both route straight into the master gain,
 * bypassing the chord filter (the filter sweep is a right-hand chord
 * control and would muffle the kit).
 */

import * as Tone from 'tone';
import type { DrumId } from './drums';

export interface DrumKit {
  hit(id: DrumId, velocity: number): void;
  dispose(): void;
}

export function createDrumKit(dest: Tone.InputNode): DrumKit {
  const out = new Tone.Gain(0.9).connect(dest);

  const kick = new Tone.MembraneSynth({
    pitchDecay: 0.05,
    octaves: 6,
    envelope: { attack: 0.001, decay: 0.45, sustain: 0, release: 0.1 },
  }).connect(out);

  const tom = new Tone.MembraneSynth({
    pitchDecay: 0.03,
    octaves: 2,
    envelope: { attack: 0.001, decay: 0.3, sustain: 0, release: 0.1 },
  }).connect(out);

  const floorTom = new Tone.MembraneSynth({
    pitchDecay: 0.04,
    octaves: 2.5,
    envelope: { attack: 0.001, decay: 0.5, sustain: 0, release: 0.1 },
  }).connect(out);

  // Snare = noise crack + short tonal body.
  const snareHp = new Tone.Filter(1200, 'highpass').connect(out);
  const snareNoise = new Tone.NoiseSynth({
    noise: { type: 'white' },
    envelope: { attack: 0.001, decay: 0.18, sustain: 0 },
  }).connect(snareHp);
  const snareBody = new Tone.MembraneSynth({
    pitchDecay: 0.01,
    octaves: 1.5,
    envelope: { attack: 0.001, decay: 0.12, sustain: 0, release: 0.05 },
  }).connect(out);
  snareBody.volume.value = -8;

  const hatHp = new Tone.Filter(7000, 'highpass').connect(out);
  const hihat = new Tone.NoiseSynth({
    noise: { type: 'white' },
    envelope: { attack: 0.001, decay: 0.06, sustain: 0 },
  }).connect(hatHp);
  hihat.volume.value = -6;

  const crashHp = new Tone.Filter(4000, 'highpass').connect(out);
  const crash = new Tone.NoiseSynth({
    noise: { type: 'white' },
    envelope: { attack: 0.002, decay: 1.4, sustain: 0 },
  }).connect(crashHp);
  crash.volume.value = -8;

  const nodes: { dispose(): unknown }[] = [
    kick, tom, floorTom, snareNoise, snareBody, snareHp, hihat, hatHp, crash, crashHp, out,
  ];

  return {
    hit(id, velocity) {
      const t = Tone.now();
      switch (id) {
        case 'kick': kick.triggerAttackRelease(50, '8n', t, velocity); break;
        case 'tom': tom.triggerAttackRelease(160, '8n', t, velocity); break;
        case 'floorTom': floorTom.triggerAttackRelease(95, '8n', t, velocity); break;
        case 'snare':
          snareNoise.triggerAttackRelease('16n', t, velocity);
          snareBody.triggerAttackRelease(190, '32n', t, velocity);
          break;
        case 'hihat': hihat.triggerAttackRelease('32n', t, velocity); break;
        case 'crash': crash.triggerAttackRelease('2n', t, velocity); break;
      }
    },
    dispose() {
      for (const n of nodes) n.dispose();
    },
  };
}

/** Electric-piano-like FM voice: quick attack, decaying body, soft release. */
export function createMelodySynth(dest: Tone.InputNode): Tone.PolySynth<Tone.FMSynth> {
  const synth = new Tone.PolySynth(Tone.FMSynth, {
    harmonicity: 2,
    modulationIndex: 3.5,
    oscillator: { type: 'sine' },
    envelope: { attack: 0.005, decay: 1.4, sustain: 0.25, release: 1.0 },
    modulation: { type: 'triangle' },
    modulationEnvelope: { attack: 0.005, decay: 0.5, sustain: 0.1, release: 0.5 },
  }).connect(dest);
  synth.volume.value = -6;
  return synth;
}
