import { useLayoutEffect, useRef, useState } from "react";
import { revealFrame } from "../editor/edit";

export type Viewport = { left: number; zoom: number };

export function useWaveformViewport(length: number, cursor: number, playing: boolean) {
  const [viewport, setViewport] = useState<Viewport>({ left: 0, zoom: 1 });
  const [rangeDragging, setRangeDragging] = useState(false);
  const { zoom, left } = viewport;
  const previousView = useRef({ cursor, zoom });

  useLayoutEffect(() => {
    if (rangeDragging) return;
    const previous = previousView.current;
    previousView.current = { cursor, zoom };
    // Let users browse the waveform with the arrows while paused.
    if (!length || (!playing && cursor === previous.cursor && zoom === previous.zoom)) return;
    const nextLeft = revealFrame(left, Math.ceil(length / zoom), length, cursor, playing);
    if (nextLeft !== left) setViewport({ left: nextLeft, zoom });
  }, [cursor, left, length, playing, rangeDragging, zoom]);

  return { viewport, setViewport, setRangeDragging };
}
