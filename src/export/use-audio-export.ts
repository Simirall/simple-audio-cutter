import { useEffect, useRef, useState } from "react";
import type { Audio } from "../audio/audio";
import type { Range } from "../editor/edit";
import type { Format } from "./encode-audio";
import { exportFileName } from "./export-file-name";

const baseFormats: Format[] = ["mp3", "m4a", "wav"];
export const formatLabels = {
  mp3: "MP3",
  m4a: "M4A (AAC)",
  wav: "WAV",
  ogg: "Ogg (Opus)",
  flac: "FLAC",
} satisfies Record<Format, string>;

export function useAudioExport(audio: Audio | null, clearError: () => void) {
  const [format, setFormat] = useState<Format>("mp3");
  const [nameByDate, setNameByDate] = useState(false);
  const [choices, setChoices] = useState(baseFormats);
  const [download, setDownload] = useState<{ url: string; name: string } | null>(null);
  const exportLink = useRef<HTMLAnchorElement>(null);
  const originalName = exportFileName(audio?.name ?? "", format);
  const dateName = exportFileName(audio?.name ?? "", format, new Date());

  useEffect(() => {
    if (!audio) return;
    let current = true;
    void import("./encode-audio")
      .then(async ({ supportsFormat }) => {
        const results = await Promise.all(
          (["ogg", "flac"] as const).map(async (id) =>
            (await supportsFormat(id, audio.buffer).catch(() => false)) ? [id] : [],
          ),
        );
        if (current) setChoices([...baseFormats, ...results.flat()]);
      })
      .catch(() => {});
    return () => {
      current = false;
    };
  }, [audio]);

  useEffect(() => {
    if (!download) return;
    exportLink.current?.click();
    return () => URL.revokeObjectURL(download.url);
  }, [download]);

  function clearDownload() {
    setDownload(null);
  }

  return {
    format,
    choices,
    nameByDate,
    originalName,
    dateName,
    download,
    exportLink,
    clearDownload,
    changeFormat: (next: Format) => {
      setFormat(next);
      clearDownload();
      clearError();
    },
    changeNameByDate: (next: boolean) => {
      setNameByDate(next);
      clearDownload();
      clearError();
    },
    reset() {
      setFormat("mp3");
      setChoices(baseFormats);
      clearDownload();
    },
    async save(
      buffer: AudioBuffer,
      range: Range,
      fades: Range,
      signal: AbortSignal,
      onProgress: (progress: number) => void,
    ) {
      const name = nameByDate ? dateName : originalName;
      const { encodeAudio } = await import("./encode-audio");
      signal.throwIfAborted();
      const blob = await encodeAudio(buffer, range, fades[0], fades[1], format, signal, onProgress);
      signal.throwIfAborted();
      setDownload({ url: URL.createObjectURL(blob), name });
    },
  };
}
