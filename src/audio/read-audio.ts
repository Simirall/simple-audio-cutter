import {
  ADTS,
  AudioBufferSink,
  BlobSource,
  FLAC,
  Input,
  MP3,
  MP4,
  OGG,
  WAVE,
  WEBM,
} from "mediabunny";

export const peakSize = 128;

export type Audio = {
  name: string;
  buffer: AudioBuffer;
  frames: number;
  peaks: Float32Array;
};

type Progress = (fraction: number) => void;

export async function readAudio(
  file: File,
  signal: AbortSignal,
  progress: Progress,
): Promise<Audio> {
  const input = new Input({
    source: new BlobSource(file),
    formats: [MP3, WAVE, MP4, ADTS, OGG, WEBM, FLAC],
  });
  const dispose = () => input.dispose();
  signal.addEventListener("abort", dispose, { once: true });
  try {
    const tracks = await input.getAudioTracks();
    if (tracks.length !== 1 || (await input.getVideoTracks()).length) {
      throw new Error("音声トラックが1つだけのファイルを選んでください。");
    }
    const track = tracks[0];
    const [numberOfChannels, sampleRate, first, end, decodable] = await Promise.all([
      track.getNumberOfChannels(),
      track.getSampleRate(),
      track.getFirstTimestamp(),
      track.computeDuration(),
      track.canDecode(),
    ]);
    if (numberOfChannels !== 1 && numberOfChannels !== 2)
      throw new Error("モノラルまたはステレオの音声を選んでください。");
    if (!decodable) throw new Error("このブラウザでは、この音声の形式を読み込めません。");
    const expected = Math.round((end - first) * sampleRate);
    const limit = Math.floor((256 * 1024 ** 2) / (4 * numberOfChannels));
    if (expected > limit)
      throw new Error("展開した音声が256 MiBを超えます。短いファイルを選んでください。");
    if (!(expected > 0) || !Number.isFinite(expected))
      throw new Error("音声が空か、長さを取得できません。");
    const length = Math.min(limit, expected + sampleRate);
    const buffer = new AudioBuffer({ numberOfChannels, sampleRate, length });
    const peaks = new Float32Array(Math.ceil(length / peakSize));
    let frames = 0;
    let lastUpdate = performance.now();
    for await (const chunk of new AudioBufferSink(track).buffers()) {
      signal.throwIfAborted();
      const data = chunk.buffer;
      if (data.sampleRate !== sampleRate || data.numberOfChannels !== numberOfChannels) {
        throw new Error(
          "途中で音声のサンプルレートやチャンネル数が変わるファイルには対応していません。",
        );
      }
      const offset = Math.round((chunk.timestamp - first) * sampleRate);
      const skip = Math.max(0, -offset, frames - offset);
      if (skip >= data.length) continue;
      if (offset + data.length > length)
        throw new Error("展開後の音声が見積もりサイズを超えました。");
      for (let channel = 0; channel < numberOfChannels; channel++) {
        const samples = data.getChannelData(channel);
        buffer.copyToChannel(samples.subarray(skip), channel, offset + skip);
        for (let i = skip; i < samples.length; i++) {
          const bin = Math.floor((offset + i) / peakSize);
          peaks[bin] = Math.max(peaks[bin], Math.abs(samples[i]));
        }
      }
      frames = offset + data.length;
      if (performance.now() - lastUpdate > 32) {
        progress(Math.min(0.99, frames / expected));
        await new Promise<void>((resolve) => setTimeout(resolve, 0));
        lastUpdate = performance.now();
      }
    }
    signal.throwIfAborted();
    if (!frames) throw new Error("再生できる音声がありません。");
    return { name: file.name, buffer, frames, peaks };
  } finally {
    signal.removeEventListener("abort", dispose);
    dispose();
  }
}
