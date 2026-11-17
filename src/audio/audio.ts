export const peakSize = 128;

export type Audio = {
  name: string;
  buffer: AudioBuffer;
  frames: number;
  peaks: Float32Array;
};
