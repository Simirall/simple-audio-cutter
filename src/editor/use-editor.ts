import { useAtomValue, useStore } from "jotai";
import { useState } from "react";
import { useAudioJob } from "../audio/use-audio-job";
import { useAudioExport } from "../export/use-audio-export";
import { usePlayback } from "../playback/use-playback";
import { resolveEdit } from "./edit";
import type { EditSettings } from "./edit";
import { editorAtom, editResultAtom, initialEdit } from "./editor-state";

export function useEditor() {
  const store = useStore();
  const { audio, edit } = useAtomValue(editorAtom);
  const { fades, invalid } = useAtomValue(editResultAtom);
  const [fileVersion, setFileVersion] = useState(0);
  const { job, progress, error, setProgress, setError, run, cancel } = useAudioJob();
  const playback = usePlayback(audio?.buffer, edit.range, fades, !invalid);
  const audioExport = useAudioExport(audio, () => setError(""));

  function applyEdit(changes: Partial<EditSettings>) {
    const { audio, edit } = store.get(editorAtom);
    if (!audio) return;
    const next = { ...edit, ...changes };
    if (
      next.range[0] === edit.range[0] &&
      next.range[1] === edit.range[1] &&
      next.fadeIn === edit.fadeIn &&
      next.fadeOut === edit.fadeOut
    ) {
      return;
    }
    const { fades, invalid } = resolveEdit(next, audio.buffer.sampleRate);
    playback.applyEdit(edit.range, { range: next.range, fades, allowed: !invalid });
    store.set(editorAtom, { audio, edit: next });
    audioExport.clearDownload();
    setError("");
  }

  function load(file: File) {
    playback.pause();
    void run("read", async (signal) => {
      const { readAudio } = await import("../audio/read-audio");
      const next = await readAudio(file, signal, setProgress);
      signal.throwIfAborted();
      playback.reset();
      store.set(editorAtom, { audio: next, edit: initialEdit(next.frames) });
      setFileVersion((version) => version + 1);
      audioExport.reset();
    });
  }

  function save() {
    if (!audio || invalid) return;
    audioExport.clearDownload();
    playback.pause();
    void run("write", (signal) =>
      audioExport.save(audio.buffer, edit.range, fades, signal, setProgress),
    );
  }

  return {
    audio,
    fileVersion,
    job,
    progress,
    error: error || (playback.error ? "音声を再生できませんでした。" : ""),
    setError,
    cancel,
    playback,
    audioExport,
    applyEdit,
    load,
    save,
  };
}
