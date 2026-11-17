import {
  ADTS,
  AudioBufferSink,
  AudioBufferSource,
  BlobSource,
  BufferTarget,
  canEncodeAudio,
  FLAC,
  FlacOutputFormat,
  Input,
  MP3,
  MP4,
  Mp3OutputFormat,
  Mp4OutputFormat,
  OGG,
  OggOutputFormat,
  Output,
  WAVE,
  WEBM,
  WavOutputFormat,
} from "mediabunny";
import { frameCount, gainAt } from "./edit";
import type { Range } from "./edit";

export const peakSize = 128;
export const formats = {
  mp3: {
    label: "MP3",
    codec: "mp3",
    bitrate: 192_000,
    container: Mp3OutputFormat,
    mime: "audio/mpeg",
  },
  m4a: {
    label: "M4A (AAC)",
    codec: "aac",
    bitrate: 192_000,
    container: Mp4OutputFormat,
    mime: "audio/mp4",
  },
  wav: {
    label: "WAV",
    codec: "pcm-s16",
    bitrate: undefined,
    container: WavOutputFormat,
    mime: "audio/wav",
  },
  ogg: {
    label: "Ogg (Opus)",
    codec: "opus",
    bitrate: 192_000,
    container: OggOutputFormat,
    mime: "audio/ogg",
  },
  flac: {
    label: "FLAC",
    codec: "flac",
    bitrate: undefined,
    container: FlacOutputFormat,
    mime: "audio/flac",
  },
} as const;

export type Format = keyof typeof formats;
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

function encoding(format: Format, buffer: AudioBuffer) {
  return {
    numberOfChannels: buffer.numberOfChannels,
    sampleRate: buffer.sampleRate,
    bitrate: formats[format].bitrate,
  };
}

export function supportsFormat(format: Format, buffer: AudioBuffer) {
  return canEncodeAudio(formats[format].codec, encoding(format, buffer));
}

let mp3Encoder: Promise<void> | undefined;
let aacEncoder: Promise<void> | undefined;

export async function encodeAudio(
  buffer: AudioBuffer,
  range: Range,
  fadeIn: number,
  fadeOut: number,
  format: Format,
  signal: AbortSignal,
  progress: Progress,
) {
  if (format === "mp3" && !(await supportsFormat(format, buffer))) {
    await (mp3Encoder ??= import("@mediabunny/mp3-encoder").then(({ registerMp3Encoder }) =>
      registerMp3Encoder(),
    ));
  }
  if (format === "m4a" && !(await supportsFormat(format, buffer))) {
    await (aacEncoder ??= import("@mediabunny/aac-encoder").then(({ registerAacEncoder }) =>
      registerAacEncoder(),
    ));
  }
  signal.throwIfAborted();
  const { codec, bitrate, container, mime } = formats[format];
  if (!(await supportsFormat(format, buffer))) {
    throw new Error(
      "この形式は元音声のサンプルレートでは保存できません。別の出力形式を選んでください。",
    );
  }
  signal.throwIfAborted();
  const target = new BufferTarget();
  const output = new Output({ format: new container(), target });
  const source = new AudioBufferSource({ codec, ...(bitrate ? { bitrate } : {}) });
  output.addAudioTrack(source);
  const cancel = () => {
    void output.cancel().catch(() => {});
  };
  signal.addEventListener("abort", cancel, { once: true });
  const { numberOfChannels, sampleRate } = buffer;
  const total = frameCount(range);
  const [start, end] = range;
  try {
    await output.start();
    for (let from = start; from < end; from += 16_384) {
      signal.throwIfAborted();
      const length = Math.min(16_384, end - from);
      const chunk = new AudioBuffer({ numberOfChannels, sampleRate, length });
      for (let channel = 0; channel < numberOfChannels; channel++) {
        const data = buffer.getChannelData(channel).subarray(from, from + length);
        const destination = chunk.getChannelData(channel);
        for (let i = 0; i < length; i++) {
          destination[i] = data[i] * gainAt(from - start + i, total, fadeIn, fadeOut);
        }
      }
      await source.add(chunk);
      progress(Math.min(0.99, (from - start + length) / total));
      await new Promise<void>((resolve) => setTimeout(resolve, 0));
    }
    signal.throwIfAborted();
    source.close();
    await output.finalize();
    signal.throwIfAborted();
    if (!target.buffer) throw new Error("出力ファイルを生成できませんでした。");
    return new Blob([target.buffer], { type: mime });
  } catch (error) {
    await output.cancel().catch(() => {});
    throw error;
  } finally {
    signal.removeEventListener("abort", cancel);
  }
}
