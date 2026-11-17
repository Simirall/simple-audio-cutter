import { atom, useSetAtom, useStore } from "jotai";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  clampPosition,
  frameCount,
  gainAt,
  outputPosition,
  remapPosition,
  sourcePosition,
} from "../editor/edit";
import type { Range } from "../editor/edit";

export const playbackPositionAtom = atom(0);

const seekDelay = 120;
type Edit = { range: Range; fades: Range; allowed: boolean };

export function usePlayback(
  buffer: AudioBuffer | undefined,
  range: Range,
  fades: Range,
  allowed: boolean,
) {
  const store = useStore();
  const setPosition = useSetAtom(playbackPositionAtom);
  const [playing, setPlaying] = useState(false);
  const [error, setError] = useState(false);
  const context = useRef<AudioContext | null>(null);
  const graph = useRef<{
    gain: GainNode;
    source: AudioBufferSourceNode;
    sourceFrame: () => number;
  } | null>(null);
  const animation = useRef(0);
  const version = useRef(0);
  const scrubPointer = useRef<number | null>(null);
  const pendingSeek = useRef<{ timer: number; commit: () => void } | null>(null);
  const length = frameCount(range);

  const disconnect = useCallback(() => {
    version.current++;
    cancelAnimationFrame(animation.current);
    if (!graph.current) return;
    const { source } = graph.current;
    source.onended = null;
    source.stop();
    source.disconnect();
    graph.current.gain.disconnect();
    graph.current = null;
  }, []);

  useEffect(() => {
    function finishScrub(event: PointerEvent) {
      if (event.pointerId !== scrubPointer.current) return;
      scrubPointer.current = null;
      if (pendingSeek.current) pendingSeek.current.commit();
      else if (!graph.current) setPlaying(false);
    }
    window.addEventListener("pointerup", finishScrub);
    window.addEventListener("pointercancel", finishScrub);
    return () => {
      window.removeEventListener("pointerup", finishScrub);
      window.removeEventListener("pointercancel", finishScrub);
      window.clearTimeout(pendingSeek.current?.timer);
      pendingSeek.current = null;
      disconnect();
      void context.current?.close();
      context.current = null;
    };
  }, [disconnect]);

  function pause() {
    scrubPointer.current = null;
    window.clearTimeout(pendingSeek.current?.timer);
    pendingSeek.current = null;
    disconnect();
    setPlaying(false);
  }

  function reset(frame = 0) {
    pause();
    setPosition(frame);
    setError(false);
  }

  async function start(from: number, edit: Edit = { range, fades, allowed }) {
    const { range, fades, allowed } = edit;
    const length = frameCount(range);
    if (!buffer || !length || !allowed) return;
    disconnect();
    const request = version.current;
    setError(false);
    try {
      const audio = (context.current ??= new AudioContext());
      if (audio.state !== "running") await audio.resume();
      if (request !== version.current) return;
      const when = audio.currentTime;
      const rate = buffer.sampleRate;
      const gain = audio.createGain();
      const frame = () =>
        clampPosition(from + Math.floor((audio.currentTime - when) * rate), length);
      const [fadeIn, fadeOut] = fades;
      const level = (frame: number) => gainAt(frame, length, fadeIn, fadeOut);
      gain.gain.setValueAtTime(level(from), when);
      const points = [fadeIn, length - 1 - fadeOut, length - 1];
      for (const frame of [...new Set(points)].sort((a, b) => a - b)) {
        if (frame > from && frame < length) {
          gain.gain.linearRampToValueAtTime(level(frame), when + (frame - from) / rate);
        }
      }
      const source = audio.createBufferSource();
      source.buffer = buffer;
      source.start(when, sourcePosition(range, from) / rate, (length - from) / rate);
      graph.current = { gain, source, sourceFrame: () => sourcePosition(range, frame()) };
      source.connect(gain);
      gain.connect(audio.destination);
      source.onended = () => {
        if (pendingSeek.current) {
          pendingSeek.current.commit();
          return;
        }
        disconnect();
        if (scrubPointer.current === null) setPlaying(false);
        setPosition(length);
      };
      setPosition(from);
      setPlaying(true);
      const tick = () => {
        setPosition(frame());
        animation.current = requestAnimationFrame(tick);
      };
      animation.current = requestAnimationFrame(tick);
    } catch {
      if (request === version.current) {
        pause();
        setError(true);
      }
    }
  }

  function seek(frame: number) {
    const target = clampPosition(frame, length);
    setPosition(target);
    if (!playing) return;
    disconnect();
    queueUpdate(() => {
      if (allowed && target < length) void start(target);
      else if (scrubPointer.current === null) pause();
    });
  }

  function queueUpdate(update: () => void) {
    window.clearTimeout(pendingSeek.current?.timer);
    const commit = () => {
      window.clearTimeout(pendingSeek.current?.timer);
      pendingSeek.current = null;
      update();
    };
    pendingSeek.current = { timer: window.setTimeout(commit, seekDelay), commit };
  }

  function applyEdit(previousRange: Range, edit: Edit) {
    const position = store.get(playbackPositionAtom);
    const nextPosition = () =>
      graph.current
        ? outputPosition(edit.range, graph.current.sourceFrame())
        : remapPosition(previousRange, edit.range, position);
    setPosition(nextPosition());
    setError(false);
    if (!playing) return;
    cancelAnimationFrame(animation.current);
    queueUpdate(() => {
      const target = nextPosition();
      setPosition(target);
      if (edit.allowed && target < frameCount(edit.range)) {
        void start(target, edit);
      } else {
        disconnect();
        if (scrubPointer.current === null) pause();
      }
    });
  }

  return {
    playing,
    error,
    pause,
    reset,
    seek,
    applyEdit,
    toggle: () => {
      if (playing) pause();
      else {
        const position = store.get(playbackPositionAtom);
        void start(position >= length ? 0 : position);
      }
    },
    beginScrub: (id: number) => {
      scrubPointer.current = id;
    },
  };
}
