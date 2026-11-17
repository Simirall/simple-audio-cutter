import {
  AudioBufferSource,
  BufferTarget,
  canEncodeAudio,
  FlacOutputFormat,
  Mp3OutputFormat,
  Mp4OutputFormat,
  OggOutputFormat,
  Output,
  WavOutputFormat,
} from "mediabunny";
import { frameCount, gainAt } from "../editor/edit";
import type { Range } from "../editor/edit";

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
type Progress = (fraction: number) => void;

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
